/* eslint-disable sonarjs/cognitive-complexity */
import { BaseNode, RuntimeLogs } from '@voiceflow/base-types';
import axios from 'axios';
import safeJSONStringify from 'json-stringify-safe';
import _ from 'lodash';
import { isDeepStrictEqual } from 'util';

import { HandlerFactory } from '@/runtime/lib/Handler';

import { getUndefinedKeys, ivmExecute, vmExecute } from './utils';

export interface CodeOptions {
  endpoint?: string | null;
  callbacks?: Record<string, (...args: any) => any>;
  useStrictVM?: boolean;
  testingEnv?: boolean;
}

export const GENERATED_CODE_NODE_ID = 'PROGRAMMATICALLY-GENERATED-CODE-NODE';

const RESOLVED_PATH = '__RESOLVED_PATH__';

const CodeHandler: HandlerFactory<BaseNode.Code.Node, CodeOptions | void> = ({
  endpoint,
  callbacks,
  useStrictVM = false,
  testingEnv = false,
} = {}) => ({
  canHandle: (node) => typeof node.code === 'string',
  handle: async (node, runtime, variables) => {
    try {
      const variablesState = variables.getState();

      const reqData = {
        code: node.code,
        variables: variablesState,
      };

      if (node.paths?.length) {
        reqData.variables = { ...reqData.variables, [RESOLVED_PATH]: null };
        reqData.code = `${RESOLVED_PATH} = (function(){\n${reqData.code}\n})()`;
      }

      let newVariableState: Record<string, any>;
      // useStrictVM used for IfV2 and SetV2 to use isolated-vm
      if (useStrictVM) {
        newVariableState = await ivmExecute(reqData, callbacks);
      } else if (endpoint) {
        // pass undefined keys explicitly because they are not sent via http JSON
        newVariableState = (await axios.post(endpoint, { ...reqData, keys: getUndefinedKeys(reqData.variables) })).data;
      } else {
        // execute locally
        newVariableState = vmExecute(reqData, testingEnv, callbacks);
      }

      // The changes (a diff) that the execution of this code made to the variables
      const changes: Record<string, RuntimeLogs.ValueChange<unknown>> = Object.fromEntries(
        [...new Set([...Object.keys(variablesState), ...Object.keys(newVariableState)])]
          .map((variable): [string, RuntimeLogs.ValueChange<unknown>] => [
            variable,
            {
              before: variablesState[variable],
              after: newVariableState[variable],
            },
          ])
          .filter(([, change]) => !isDeepStrictEqual(change.before, change.after))
      );

      const changesSummary = Object.entries(changes)
        .map(
          ([variable, change]) =>
            `\`{${variable}}\`: \`${JSON.stringify(change.before)}\` => \`${JSON.stringify(change.after)}\``
        )
        .join('\n');

      runtime.trace.debug(
        // eslint-disable-next-line sonarjs/no-nested-template-literals
        `evaluating code - ${changesSummary ? `changes:\n${changesSummary}` : 'no variable changes'}`,
        BaseNode.NodeType.CODE
      );

      if (node.id !== GENERATED_CODE_NODE_ID) {
        runtime.debugLogging.recordStepLog(RuntimeLogs.Kinds.StepLogKind.CUSTOM_CODE, node, {
          error: null,
          changedVariables: Object.fromEntries(
            Object.entries(changes).map(([variable, change]) => [
              variable,
              // `?? null` is used to ensure that no `undefined` values make it through, since they'll be excluded
              // in JSON.stringify
              {
                before: change.before ?? null,
                after: change.after ?? null,
              },
            ])
          ),
        });
      }

      const { [RESOLVED_PATH]: resolvedPath, ...mergeVariableState } = newVariableState;

      variables.merge(mergeVariableState);

      if (node.paths?.length && resolvedPath) {
        // eslint-disable-next-line no-restricted-syntax
        for (const path of node.paths) {
          if (path.label === resolvedPath) {
            return path.nextId ?? null;
          }
        }
      }

      return node.success_id ?? null;
    } catch (error) {
      const serializedError = error.response?.data || error.toString();
      runtime.trace.debug(
        `unable to resolve code  \n\`${safeJSONStringify(serializedError)}\``,
        BaseNode.NodeType.CODE
      );
      if (node.id !== GENERATED_CODE_NODE_ID) {
        runtime.debugLogging.recordStepLog(
          RuntimeLogs.Kinds.StepLogKind.CUSTOM_CODE,
          node,
          {
            error: serializedError,
            changedVariables: null,
          },
          RuntimeLogs.LogLevel.ERROR
        );
      }

      return node.fail_id ?? null;
    }
  },
});

export default CodeHandler;
