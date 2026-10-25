/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

/**
 * @title Agent Ops API
 * @version 1.0
 * @baseUrl //localhost:8080
 * @contact
 *
 * API for repository synchronization and signed webhooks.
 */
export class Api<
  SecurityDataType extends unknown,
> extends HttpClient<SecurityDataType> {
  api = {
    /**
     * No description
     *
     * @name V1AgentRunsAggregateList
     * @summary Aggregate agent runs
     * @request GET:/api/v1/agent-runs/aggregate
     */
    v1AgentRunsAggregateList: (
      query?: {
        /** Issue number */
        issue_number?: number;
        /** Repository UUID */
        repository_id?: string;
        /** Wave */
        wave?: string;
      },
      reqParams: RequestParams = {},
    ) =>
      this.request<AgentrunAggregateResponse, any>({
        path: `/api/v1/agent-runs/aggregate`,
        method: "GET",
        query: query,
        format: "json",
        ...reqParams,
      }),

    /**
     * No description
     *
     * @name V1AgentRunsCreate
     * @summary Create an agent run
     * @request POST:/api/v1/agent-runs
     * @secure
     */
    v1AgentRunsCreate: (
      request: AgentrunCreateInput,
      reqParams: RequestParams = {},
    ) =>
      this.request<AgentrunCreatedResponse, ResponseErrorResponse>({
        path: `/api/v1/agent-runs`,
        method: "POST",
        body: request,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...reqParams,
      }),

    /**
     * No description
     *
     * @name V1AgentRunsList
     * @summary List agent runs
     * @request GET:/api/v1/agent-runs
     */
    v1AgentRunsList: (
      query?: {
        /** Issue number */
        issue_number?: number;
        /** Repository UUID */
        repository_id?: string;
        /** Wave */
        wave?: string;
      },
      reqParams: RequestParams = {},
    ) =>
      this.request<AgentrunListResponse, any>({
        path: `/api/v1/agent-runs`,
        method: "GET",
        query: query,
        format: "json",
        ...reqParams,
      }),

    /**
     * No description
     *
     * @name V1BoardList
     * @summary List board issues
     * @request GET:/api/v1/board
     */
    v1BoardList: (
      query: {
        /** Page */
        page?: number;
        /** Items per page */
        per_page?: number;
        /** Repository UUID */
        repository_id: string;
      },
      reqParams: RequestParams = {},
    ) =>
      this.request<BoardListResponse, ResponseErrorResponse>({
        path: `/api/v1/board`,
        method: "GET",
        query: query,
        format: "json",
        ...reqParams,
      }),

    /**
     * No description
     *
     * @name V1BoardWsList
     * @summary Board invalidation websocket handshake
     * @request GET:/api/v1/board/ws
     */
    v1BoardWsList: (
      query: {
        /**
         * Repository UUID
         * @format uuid
         */
        repository_id: string;
      },
      reqParams: RequestParams = {},
    ) =>
      this.request<any, string | ResponseErrorResponse>({
        path: `/api/v1/board/ws`,
        method: "GET",
        query: query,
        ...reqParams,
      }),

    /**
     * No description
     *
     * @name V1InsightsList
     * @summary Get repository insights
     * @request GET:/api/v1/insights
     */
    v1InsightsList: (
      query: {
        /**
         * Repository UUID
         * @format uuid
         */
        repository_id: string;
      },
      reqParams: RequestParams = {},
    ) =>
      this.request<InsightEnvelope, ResponseErrorResponse>({
        path: `/api/v1/insights`,
        method: "GET",
        query: query,
        format: "json",
        ...reqParams,
      }),

    /**
     * No description
     *
     * @name V1RepositoriesList
     * @summary List repositories
     * @request GET:/api/v1/repositories
     */
    v1RepositoriesList: (
      query?: {
        /** Page */
        page?: number;
        /** Items per page */
        per_page?: number;
      },
      reqParams: RequestParams = {},
    ) =>
      this.request<BoardListResponse, ResponseErrorResponse>({
        path: `/api/v1/repositories`,
        method: "GET",
        query: query,
        format: "json",
        ...reqParams,
      }),

    /**
     * No description
     *
     * @name V1WebhooksCreate
     * @summary Ingest provider webhook
     * @request POST:/api/v1/webhooks/{provider}
     */
    v1WebhooksCreate: (
      provider: string,
      body: Record<string, any>,
      reqParams: RequestParams = {},
    ) =>
      this.request<ResponseSuccessResponse, ResponseErrorResponse>({
        path: `/api/v1/webhooks/${provider}`,
        method: "POST",
        body: body,
        type: ContentType.Json,
        format: "json",
        ...reqParams,
      }),
  };
  healthz = {
    /**
     * No description
     *
     * @name HealthzList
     * @summary Process health
     * @request GET:/healthz
     */
    healthzList: (reqParams: RequestParams = {}) =>
      this.request<ResponseSuccessResponse, any>({
        path: `/healthz`,
        method: "GET",
        format: "json",
        ...reqParams,
      }),
  };
  readyz = {
    /**
     * No description
     *
     * @name ReadyzList
     * @summary Database readiness
     * @request GET:/readyz
     */
    readyzList: (reqParams: RequestParams = {}) =>
      this.request<ResponseSuccessResponse, ResponseErrorResponse>({
        path: `/readyz`,
        method: "GET",
        format: "json",
        ...reqParams,
      }),
  };
}
