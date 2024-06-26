import { routeWrapper } from '@/lib/utils';
import { Config, MiddlewareGroup } from '@/types';

import { FullServiceMap } from '../services';
import Auth from './auth';
import { BillingMiddleware } from './billing';
import LLMLimit from './llmLimit';
import Project from './project';
import RateLimit from './rateLimit';

export interface MiddlewareMap {
  billing: BillingMiddleware;
  auth: Auth;
  project: Project;
  rateLimit: RateLimit;
  llmLimit: LLMLimit;
}

export interface MiddlewareClass<T = MiddlewareGroup> {
  new (services: FullServiceMap, config: Config): T;
}

/**
 * Build all middlewares
 */
const buildMiddleware = (services: FullServiceMap, config: Config) => {
  const middlewares: MiddlewareMap = {
    billing: new BillingMiddleware(services, config),
    auth: new Auth(services, config),
    project: new Project(services, config),
    rateLimit: new RateLimit(services, config),
    llmLimit: new LLMLimit(services, config),
  };

  // everything before this will be route-wrapped
  routeWrapper(middlewares);

  return middlewares;
};

export default buildMiddleware;
