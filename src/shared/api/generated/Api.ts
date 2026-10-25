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

export interface AgentrunAgentRun {
  cache_write_tokens?: number;
  cached_input_tokens?: number;
  cost_usd?: number;
  created_at?: string;
  ended_at?: string;
  id?: string;
  input_tokens?: number;
  issue_numbers?: number[];
  model?: string;
  output_tokens?: number;
  pr_number?: number;
  reasoning_tokens?: number;
  repository_id?: string;
  started_at?: string;
  updated_at?: string;
  wave?: string;
  worker?: string;
}

export interface AgentrunAggregate {
  cache_write_tokens?: number;
  cached_input_tokens?: number;
  cost_usd?: number;
  input_tokens?: number;
  issue_number?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  runs?: number;
  wave?: string;
  worker?: string;
}

export interface AgentrunAggregateResponse {
  data?: AgentrunAggregate[];
  status?: number;
}

export interface AgentrunCreateInput {
  cache_write_tokens?: number;
  cached_input_tokens?: number;
  ended_at: string;
  input_tokens?: number;
  issue_numbers?: number[];
  model: string;
  output_tokens?: number;
  pr_number?: number;
  reasoning_tokens?: number;
  repository_id: string;
  started_at: string;
  wave: string;
  worker: string;
}

export interface AgentrunCreatedResponse {
  data?: AgentrunAgentRun;
  status?: number;
}

export interface AgentrunListResponse {
  data?: AgentrunAgentRun[];
  status?: number;
}

export interface AuthLoginRequest {
  email?: string;
  password?: string;
}

export interface AuthLoginResponse {
  token?: string;
}

export interface AuthSessionResponse {
  account_id?: string;
  email?: string;
}

export interface BoardListMeta {
  page?: number;
  per_page?: number;
  total?: number;
}

export interface BoardListResponse {
  data?: any;
  meta?: BoardListMeta;
}

export interface InsightCycleMetric {
  completed?: number;
  evidence?: InsightEvidence[];
  median_seconds?: number;
}

export interface InsightEnvelope {
  data?: InsightResponse;
}

export interface InsightEvidence {
  delivery_id?: string;
  event_type?: string;
  issue_number?: number;
  pr_number?: number;
  received_at?: string;
  source_at?: string;
}

export interface InsightFirstCIMetric {
  eligible?: number;
  evidence?: InsightEvidence[];
  rate?: number;
  successful?: number;
}

export interface InsightHistory {
  complete?: boolean;
  reason?: string;
}

export interface InsightResponse {
  cycle_time?: InsightCycleMetric;
  first_ci_success?: InsightFirstCIMetric;
  history?: InsightHistory;
  repository_id?: string;
  send_back?: InsightSendBackMetric;
  suggestions?: InsightSuggestion[];
}

export interface InsightSendBackMetric {
  count?: number;
  denominator?: number;
  evidence?: InsightEvidence[];
  numerator?: number;
  rate?: number;
}

export interface InsightSuggestion {
  evidence?: InsightEvidence[];
  key?: string;
  message?: string;
  occurrences?: number;
}

export interface OrganizationAddMemberRequest {
  account_id: string;
  role: string;
}

export interface OrganizationCreateRequest {
  name: string;
}

export interface OrganizationUpdateRoleRequest {
  role: string;
}

export interface ResponseErrorResponse {
  message?: string;
  status?: number;
}

export interface ResponseMessageResponse {
  message?: string;
  status?: number;
}

export interface ResponseSuccessResponse {
  data?: any;
  status?: number;
}

export type QueryParamsType = Record<string | number, any>;
export type ResponseFormat =
  | "json"
  | "text"
  | "blob"
  | "arrayBuffer"
  | "formData";

export interface FullRequestParams extends Omit<RequestInit, "body"> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  type?: ContentType;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseFormat;
  /** request body */
  body?: unknown;
  /** base url */
  baseUrl?: string;
  /** request cancellation token */
  cancelToken?: CancelToken;
}

export type RequestParams = Omit<
  FullRequestParams,
  "body" | "method" | "query" | "path"
>;

export interface ApiConfig<SecurityDataType = unknown> {
  instance?: import("axios").AxiosInstance;
  baseUrl?: string;
  baseApiParams?: Omit<RequestParams, "baseUrl" | "cancelToken" | "signal">;
  securityWorker?: (
    securityData: SecurityDataType | null,
  ) => Promise<RequestParams | void> | RequestParams | void;
  customFetch?: typeof fetch;
}

export interface HttpResponse<D extends unknown, E extends unknown = unknown>
  extends Response {
  data: D;
  error: E;
}

type CancelToken = Symbol | string | number;

export enum ContentType {
  Json = "application/json",
  FormData = "multipart/form-data",
  UrlEncoded = "application/x-www-form-urlencoded",
  Text = "text/plain",
}

export class HttpClient<SecurityDataType = unknown> {
  public instance: import("axios").AxiosInstance;
  public baseUrl: string = "";
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>["securityWorker"];
  private abortControllers = new Map<CancelToken, AbortController>();
  private customFetch = (...fetchParams: Parameters<typeof fetch>) =>
    this.fetchAxios(...fetchParams);

  private async fetchAxios(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const config = {
      url: String(input),
      method: init?.method,
      headers: init?.headers as Record<string, string>,
      data: init?.body,
      responseType: "json",
    };
    const response = await this.instance.request(config);
    const request = this.instance.getUri(config);
    return new Response(JSON.stringify(response.data), {
      status: response.status,
      headers: { "x-request-url": request },
    });
  }

  private baseApiParams: RequestParams = {
    credentials: "same-origin",
    headers: {},
    redirect: "follow",
    referrerPolicy: "no-referrer",
  };

  constructor(apiConfig: ApiConfig<SecurityDataType> = {}) {
    if (!apiConfig.instance) throw new Error("An Axios instance is required");
    this.instance = apiConfig.instance;
    Object.assign(this, apiConfig);
    this.baseUrl = apiConfig.baseUrl || "";
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  protected encodeQueryParam(key: string, value: any) {
    const encodedKey = encodeURIComponent(key);
    return `${encodedKey}=${encodeURIComponent(typeof value === "number" ? value : `${value}`)}`;
  }

  protected addQueryParam(query: QueryParamsType, key: string) {
    return this.encodeQueryParam(key, query[key]);
  }

  protected addArrayQueryParam(query: QueryParamsType, key: string) {
    const value = query[key];
    return value.map((v: any) => this.encodeQueryParam(key, v)).join("&");
  }

  protected toQueryString(rawQuery?: QueryParamsType): string {
    const query = rawQuery || {};
    const keys = Object.keys(query).filter(
      (key) => "undefined" !== typeof query[key],
    );
    return keys
      .map((key) =>
        Array.isArray(query[key])
          ? this.addArrayQueryParam(query, key)
          : this.addQueryParam(query, key),
      )
      .join("&");
  }

  protected addQueryParams(rawQuery?: QueryParamsType): string {
    const queryString = this.toQueryString(rawQuery);
    return queryString ? `?${queryString}` : "";
  }

  private contentFormatters: Record<ContentType, (input: any) => any> = {
    [ContentType.Json]: (input: any) =>
      input !== null && (typeof input === "object" || typeof input === "string")
        ? JSON.stringify(input)
        : input,
    [ContentType.Text]: (input: any) =>
      input !== null && typeof input !== "string"
        ? JSON.stringify(input)
        : input,
    [ContentType.FormData]: (input: any) =>
      Object.keys(input || {}).reduce((formData, key) => {
        const property = input[key];
        formData.append(
          key,
          property instanceof Blob
            ? property
            : typeof property === "object" && property !== null
              ? JSON.stringify(property)
              : `${property}`,
        );
        return formData;
      }, new FormData()),
    [ContentType.UrlEncoded]: (input: any) => this.toQueryString(input),
  };

  protected mergeRequestParams(
    params1: RequestParams,
    params2?: RequestParams,
  ): RequestParams {
    return {
      ...this.baseApiParams,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...(this.baseApiParams.headers || {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  protected createAbortSignal = (
    cancelToken: CancelToken,
  ): AbortSignal | undefined => {
    if (this.abortControllers.has(cancelToken)) {
      const abortController = this.abortControllers.get(cancelToken);
      if (abortController) {
        return abortController.signal;
      }
      return void 0;
    }

    const abortController = new AbortController();
    this.abortControllers.set(cancelToken, abortController);
    return abortController.signal;
  };

  public abortRequest = (cancelToken: CancelToken) => {
    const abortController = this.abortControllers.get(cancelToken);

    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(cancelToken);
    }
  };

  public request = async <T = any, E = any>({
    body,
    secure,
    path,
    type,
    query,
    format,
    baseUrl,
    cancelToken,
    ...params
  }: FullRequestParams): Promise<HttpResponse<T, E>> => {
    const secureParams =
      ((typeof secure === "boolean" ? secure : this.baseApiParams.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const queryString = query && this.toQueryString(query);
    const payloadFormatter = this.contentFormatters[type || ContentType.Json];
    const responseFormat = format || requestParams.format;

    return this.customFetch(
      `${baseUrl || this.baseUrl || ""}${path}${queryString ? `?${queryString}` : ""}`,
      {
        ...requestParams,
        headers: {
          ...(requestParams.headers || {}),
          ...(type && type !== ContentType.FormData
            ? { "Content-Type": type }
            : {}),
        },
        signal:
          (cancelToken
            ? this.createAbortSignal(cancelToken)
            : requestParams.signal) || null,
        body:
          typeof body === "undefined" || body === null
            ? null
            : payloadFormatter(body),
      },
    ).then(async (response) => {
      const r = response.clone() as HttpResponse<T, E>;
      r.data = null as unknown as T;
      r.error = null as unknown as E;

      const data = !responseFormat
        ? r
        : await response[responseFormat]()
            .then((data) => {
              if (r.ok) {
                r.data = data;
              } else {
                r.error = data;
              }
              return r;
            })
            .catch((e) => {
              r.error = e;
              return r;
            });

      if (cancelToken) {
        this.abortControllers.delete(cancelToken);
      }

      if (!response.ok) throw data;
      return data;
    });
  };
}

/**
 * @title Agent Ops API
 * @version 1.0
 * @baseUrl //localhost:8080
 * @contact
 *
 * API for repository synchronization and signed webhooks.
 */
export class Api<SecurityDataType extends unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

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
      params: RequestParams = {},
    ) =>
      this.http.request<AgentrunAggregateResponse, any>({
        path: `/api/v1/agent-runs/aggregate`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
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
      params: RequestParams = {},
    ) =>
      this.http.request<AgentrunCreatedResponse, ResponseErrorResponse>({
        path: `/api/v1/agent-runs`,
        method: "POST",
        body: request,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
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
      params: RequestParams = {},
    ) =>
      this.http.request<AgentrunListResponse, any>({
        path: `/api/v1/agent-runs`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name V1AuthLoginCreate
     * @summary Login
     * @request POST:/api/v1/auth/login
     */
    v1AuthLoginCreate: (
      credentials: AuthLoginRequest,
      params: RequestParams = {},
    ) =>
      this.http.request<AuthLoginResponse, ResponseErrorResponse>({
        path: `/api/v1/auth/login`,
        method: "POST",
        body: credentials,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name V1AuthSessionList
     * @summary Current session
     * @request GET:/api/v1/auth/session
     */
    v1AuthSessionList: (params: RequestParams = {}) =>
      this.http.request<AuthSessionResponse, ResponseErrorResponse>({
        path: `/api/v1/auth/session`,
        method: "GET",
        format: "json",
        ...params,
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
      params: RequestParams = {},
    ) =>
      this.http.request<BoardListResponse, ResponseErrorResponse>({
        path: `/api/v1/board`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
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
      params: RequestParams = {},
    ) =>
      this.http.request<any, string | ResponseErrorResponse>({
        path: `/api/v1/board/ws`,
        method: "GET",
        query: query,
        ...params,
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
      params: RequestParams = {},
    ) =>
      this.http.request<InsightEnvelope, ResponseErrorResponse>({
        path: `/api/v1/insights`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name V1OrganizationsCreate
     * @summary Create organization
     * @request POST:/api/v1/organizations
     */
    v1OrganizationsCreate: (
      request: OrganizationCreateRequest,
      params: RequestParams = {},
    ) =>
      this.http.request<ResponseSuccessResponse, ResponseErrorResponse>({
        path: `/api/v1/organizations`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name V1OrganizationsDetail
     * @summary Organization detail
     * @request GET:/api/v1/organizations/{organization_id}
     */
    v1OrganizationsDetail: (
      organizationId: string,
      params: RequestParams = {},
    ) =>
      this.http.request<ResponseSuccessResponse, ResponseErrorResponse>({
        path: `/api/v1/organizations/${organizationId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name V1OrganizationsList
     * @summary List organizations
     * @request GET:/api/v1/organizations
     */
    v1OrganizationsList: (params: RequestParams = {}) =>
      this.http.request<ResponseSuccessResponse, ResponseErrorResponse>({
        path: `/api/v1/organizations`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name V1OrganizationsMembersCreate
     * @summary Add organization member
     * @request POST:/api/v1/organizations/{organization_id}/members
     */
    v1OrganizationsMembersCreate: (
      organizationId: string,
      request: OrganizationAddMemberRequest,
      params: RequestParams = {},
    ) =>
      this.http.request<ResponseMessageResponse, ResponseErrorResponse>({
        path: `/api/v1/organizations/${organizationId}/members`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name V1OrganizationsMembersDelete
     * @summary Remove organization member
     * @request DELETE:/api/v1/organizations/{organization_id}/members/{account_id}
     */
    v1OrganizationsMembersDelete: (
      organizationId: string,
      accountId: string,
      params: RequestParams = {},
    ) =>
      this.http.request<ResponseMessageResponse, ResponseErrorResponse>({
        path: `/api/v1/organizations/${organizationId}/members/${accountId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name V1OrganizationsMembersList
     * @summary List organization members
     * @request GET:/api/v1/organizations/{organization_id}/members
     */
    v1OrganizationsMembersList: (
      organizationId: string,
      params: RequestParams = {},
    ) =>
      this.http.request<ResponseSuccessResponse, ResponseErrorResponse>({
        path: `/api/v1/organizations/${organizationId}/members`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name V1OrganizationsMembersPartialUpdate
     * @summary Update member role
     * @request PATCH:/api/v1/organizations/{organization_id}/members/{account_id}
     */
    v1OrganizationsMembersPartialUpdate: (
      organizationId: string,
      accountId: string,
      request: OrganizationUpdateRoleRequest,
      params: RequestParams = {},
    ) =>
      this.http.request<ResponseMessageResponse, ResponseErrorResponse>({
        path: `/api/v1/organizations/${organizationId}/members/${accountId}`,
        method: "PATCH",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
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
      params: RequestParams = {},
    ) =>
      this.http.request<BoardListResponse, ResponseErrorResponse>({
        path: `/api/v1/repositories`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
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
      params: RequestParams = {},
    ) =>
      this.http.request<ResponseSuccessResponse, ResponseErrorResponse>({
        path: `/api/v1/webhooks/${provider}`,
        method: "POST",
        body: body,
        type: ContentType.Json,
        format: "json",
        ...params,
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
    healthzList: (params: RequestParams = {}) =>
      this.http.request<ResponseSuccessResponse, any>({
        path: `/healthz`,
        method: "GET",
        format: "json",
        ...params,
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
    readyzList: (params: RequestParams = {}) =>
      this.http.request<ResponseSuccessResponse, ResponseErrorResponse>({
        path: `/readyz`,
        method: "GET",
        format: "json",
        ...params,
      }),
  };
}
