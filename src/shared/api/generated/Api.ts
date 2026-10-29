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
  billing_type?: string;
  cache_write_tokens?: number;
  cached_input_tokens?: number;
  cost_usd?: number;
  created_at?: string;
  ended_at?: string;
  harness?: string;
  id?: string;
  input_tokens?: number;
  issue_numbers?: number[];
  model?: string;
  output_tokens?: number;
  pr_number?: number;
  reasoning_tokens?: number;
  relations?: AgentrunRunRelations;
  repository_id?: string;
  session_id?: string;
  started_at?: string;
  updated_at?: string;
  wave?: string;
  worker?: string;
}

export interface AgentrunAggregate {
  billed_cost_usd?: number;
  cache_write_tokens?: number;
  cached_input_tokens?: number;
  cost_usd?: number;
  cost_vnd?: number;
  equivalent_cost_usd?: number;
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
  billing_type?: string;
  cache_write_tokens?: number;
  cached_input_tokens?: number;
  ended_at: string;
  harness?: string;
  input_tokens?: number;
  issue_numbers?: number[];
  model: string;
  output_tokens?: number;
  pr_number?: number;
  reasoning_tokens?: number;
  repository_id: string;
  session_id?: string;
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
  meta?: any;
  status?: number;
}

export interface AgentrunPriceVersion {
  cache_write_per_million?: number;
  cached_input_per_million?: number;
  created_at?: string;
  effective_date?: string;
  id?: string;
  input_per_million?: number;
  model?: string;
  organization_id?: string;
  output_per_million?: number;
  reasoning_per_million?: number;
  updated_at?: string;
}

export interface AgentrunRunCI {
  conclusion?: string;
  external_id?: string;
  pr_number?: number;
  repository_id?: string;
  sha?: string;
  status?: string;
}

export interface AgentrunRunIssue {
  number?: number;
  repository_id?: string;
  state?: string;
  status?: string;
  title?: string;
}

export interface AgentrunRunPullRequest {
  head_sha?: string;
  number?: number;
  repository_id?: string;
  state?: string;
  title?: string;
}

export interface AgentrunRunRelations {
  ci?: AgentrunRunCI[];
  issues?: AgentrunRunIssue[];
  pull_requests?: AgentrunRunPullRequest[];
}

export interface AgentrunRunStep {
  cache_hit?: boolean;
  cache_write_tokens?: number;
  cached_input_tokens?: number;
  cumulative_cost_usd?: number;
  ended_at?: string;
  id?: string;
  input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  run_id?: string;
  sequence?: number;
  started_at?: string;
  tool_name?: string;
}

export interface AgentrunTimelineInput {
  steps?: AgentrunRunStep[];
}

export interface AlertHistoryResponse {
  data?: AlertOccurrence[];
  meta?: PaginationPaginatorResponse;
}

export interface AlertOccurrence {
  alertKey?: string;
  detectedAt?: string;
  id?: string;
  message?: string;
  organizationID?: string;
  repository?: string;
  rule?: string;
  subject?: string;
}

export interface AuthLoginRequest {
  email?: string;
  password?: string;
}

export interface AuthLoginResponse {
  token?: string;
}

export interface AuthSelectOrganizationRequest {
  organization_id?: string;
}

export interface AuthSessionResponse {
  account_id?: string;
  email?: string;
  organization_id?: string;
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

export interface BudgetBudget {
  created_at?: string;
  ends_at?: string;
  id?: string;
  organization_id?: string;
  repository_id?: string;
  starts_at?: string;
  token_limit?: number;
  updated_at?: string;
  usd_limit?: number;
  wave?: string;
}

export interface BudgetRequest {
  ends_at?: string;
  repository_id?: string;
  starts_at?: string;
  token_limit?: number;
  usd_limit?: number;
  wave?: string;
}

export interface InsightAnalyticsBucket {
  actual_cost_usd?: number;
  cache_hit_rate?: number;
  cache_write_tokens?: number;
  cached_input_tokens?: number;
  equivalent_cost_usd?: number;
  input_tokens?: number;
  key?: string;
  output_tokens?: number;
  reasoning_tokens?: number;
  runs?: number;
  start?: string;
  unknown_price_count?: number;
}

export interface InsightAnalyticsResponse {
  bucket_timestamp?: string;
  buckets?: InsightAnalyticsBucket[];
  cache_denominator?: string;
  from?: string;
  group_by?: string;
  period?: string;
  to?: string;
  unknown_price_count?: number;
  week_starts?: string;
}

export interface InsightCycleMetric {
  completed?: number;
  evidence?: InsightEvidence[];
  median_seconds?: number;
}

export interface InsightDeliveryCostMetric {
  actual_cost_usd?: number;
  cost_per_item_usd?: number;
  count?: number;
  eligible?: number;
  equivalent_cost_usd?: number;
  unavailable?: number;
}

export interface InsightDeliveryHistory {
  complete?: boolean;
  unavailable?: number;
}

export interface InsightDeliveryResponse {
  closed_issues?: InsightDeliveryCostMetric;
  first_ci_success?: InsightFirstCIMetric;
  from?: string;
  harness_comparison?: InsightHarnessMetric[];
  history?: InsightDeliveryHistory;
  issue_to_merge_lead_time?: InsightLeadTimeMetric;
  merged_prs?: InsightDeliveryCostMetric;
  send_back?: InsightSendBackMetric;
  to?: string;
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

export interface InsightHarnessMetric {
  changed_lines?: number;
  cost_per_changed_line_usd?: number;
  eligible?: number;
  equivalent_cost_usd?: number;
  harness?: string;
  runs?: number;
  unavailable?: number;
}

export interface InsightHistory {
  complete?: boolean;
  reason?: string;
}

export interface InsightLeadTimeMetric {
  completed?: number;
  median_seconds?: number;
  unavailable?: number;
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

export interface OrganizationAcceptInvitationRequest {
  token: string;
}

export interface OrganizationAddMemberRequest {
  account_id: string;
  role: string;
}

export interface OrganizationCreateInvitationRequest {
  expires_in_seconds?: number;
  role: string;
}

export interface OrganizationCreateRequest {
  name: string;
}

export interface OrganizationUpdateRoleRequest {
  role: string;
}

export interface PaginationPaginatorResponse {
  page?: number;
  per_page?: number;
  total?: number;
}

export interface RepositorysettingsCreateRequest {
  backfill_token?: string;
  full_name?: string;
  gitlab_base_url?: string;
  provider?: string;
  status_mappings?: Record<string, string>;
  webhook_secret?: string;
}

export interface RepositorysettingsCreatedResponse {
  data?: RepositorysettingsCreatedView;
  status?: number;
}

export interface RepositorysettingsCreatedView {
  backfill_token?: string;
  full_name?: string;
  gitlab_base_url?: string;
  id?: string;
  provider?: string;
  status_mappings?: Record<string, string>;
  webhook_secret?: string;
  webhook_url?: string;
}

export interface RepositorysettingsListResponse {
  data?: RepositorysettingsView[];
  status?: number;
}

export interface RepositorysettingsUpdateRequest {
  backfill_token?: string;
  gitlab_base_url?: string;
  status_mappings?: Record<string, string>;
  webhook_secret?: string;
}

export interface RepositorysettingsView {
  full_name?: string;
  gitlab_base_url?: string;
  id?: string;
  provider?: string;
  status_mappings?: Record<string, string>;
  webhook_url?: string;
}

export interface RepositorysettingsViewResponse {
  data?: RepositorysettingsView;
  status?: number;
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
     * @name V1AgentRunPricesCreate
     * @summary Create model price version
     * @request POST:/api/v1/agent-run-prices
     * @secure
     */
    v1AgentRunPricesCreate: (
      request: AgentrunPriceVersion,
      params: RequestParams = {},
    ) =>
      this.http.request<ResponseSuccessResponse, any>({
        path: `/api/v1/agent-run-prices`,
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
     * @name V1AgentRunPricesList
     * @summary List model price versions
     * @request GET:/api/v1/agent-run-prices
     * @secure
     */
    v1AgentRunPricesList: (params: RequestParams = {}) =>
      this.http.request<ResponseSuccessResponse, any>({
        path: `/api/v1/agent-run-prices`,
        method: "GET",
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name V1AgentRunPricesPartialUpdate
     * @summary Update model price version
     * @request PATCH:/api/v1/agent-run-prices/{price_id}
     * @secure
     */
    v1AgentRunPricesPartialUpdate: (
      priceId: string,
      request: AgentrunPriceVersion,
      params: RequestParams = {},
    ) =>
      this.http.request<ResponseSuccessResponse, any>({
        path: `/api/v1/agent-run-prices/${priceId}`,
        method: "PATCH",
        body: request,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

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
     * @summary List organization-scoped agent runs
     * @request GET:/api/v1/agent-runs
     */
    v1AgentRunsList: (
      query?: {
        /** Harness identity */
        harness?: string;
        /** Issue number */
        issue_number?: number;
        /** Model identity */
        model?: string;
        /** Page number (default 1) */
        page?: number;
        /** Page size (default 20, maximum 100) */
        per_page?: number;
        /** Pull request number */
        pr_number?: number;
        /** Repository UUID */
        repository_id?: string;
        /** RFC3339 lower bound */
        started_after?: string;
        /** RFC3339 upper bound */
        started_before?: string;
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
     * @name V1AgentRunsTimelineCreate
     * @summary Ingest run timeline
     * @request POST:/api/v1/agent-runs/{run_id}/timeline
     * @secure
     */
    v1AgentRunsTimelineCreate: (
      runId: string,
      request: AgentrunTimelineInput,
      params: RequestParams = {},
    ) =>
      this.http.request<ResponseSuccessResponse, any>({
        path: `/api/v1/agent-runs/${runId}/timeline`,
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
     * @name V1AgentRunsTimelineList
     * @summary Get run timeline
     * @request GET:/api/v1/agent-runs/{run_id}/timeline
     * @secure
     */
    v1AgentRunsTimelineList: (runId: string, params: RequestParams = {}) =>
      this.http.request<ResponseSuccessResponse, any>({
        path: `/api/v1/agent-runs/${runId}/timeline`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name V1AlertsHistoryList
     * @summary List alert history
     * @request GET:/api/v1/alerts/history
     */
    v1AlertsHistoryList: (
      query?: {
        /** Page */
        page?: number;
        /** Items per page */
        per_page?: number;
      },
      params: RequestParams = {},
    ) =>
      this.http.request<AlertHistoryResponse, ResponseErrorResponse>({
        path: `/api/v1/alerts/history`,
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
     * @name V1AuthSelectOrganizationCreate
     * @summary Select organization
     * @request POST:/api/v1/auth/select-organization
     */
    v1AuthSelectOrganizationCreate: (
      request: AuthSelectOrganizationRequest,
      params: RequestParams = {},
    ) =>
      this.http.request<AuthLoginResponse, ResponseErrorResponse>({
        path: `/api/v1/auth/select-organization`,
        method: "POST",
        body: request,
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
     * @tags budgets
     * @name V1BudgetsCreate
     * @summary Create budget
     * @request POST:/api/v1/budgets
     */
    v1BudgetsCreate: (budget: BudgetRequest, params: RequestParams = {}) =>
      this.http.request<BudgetBudget, ResponseErrorResponse>({
        path: `/api/v1/budgets`,
        method: "POST",
        body: budget,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags budgets
     * @name V1BudgetsDelete
     * @summary Delete budget
     * @request DELETE:/api/v1/budgets/{budget_id}
     */
    v1BudgetsDelete: (budgetId: string, params: RequestParams = {}) =>
      this.http.request<ResponseMessageResponse, ResponseErrorResponse>({
        path: `/api/v1/budgets/${budgetId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags budgets
     * @name V1BudgetsDetail
     * @summary Get budget
     * @request GET:/api/v1/budgets/{budget_id}
     */
    v1BudgetsDetail: (budgetId: string, params: RequestParams = {}) =>
      this.http.request<BudgetBudget, ResponseErrorResponse>({
        path: `/api/v1/budgets/${budgetId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags budgets
     * @name V1BudgetsList
     * @summary List budgets
     * @request GET:/api/v1/budgets
     */
    v1BudgetsList: (params: RequestParams = {}) =>
      this.http.request<BudgetBudget[], ResponseErrorResponse>({
        path: `/api/v1/budgets`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags budgets
     * @name V1BudgetsPartialUpdate
     * @summary Update budget
     * @request PATCH:/api/v1/budgets/{budget_id}
     */
    v1BudgetsPartialUpdate: (
      budgetId: string,
      budget: BudgetRequest,
      params: RequestParams = {},
    ) =>
      this.http.request<BudgetBudget, ResponseErrorResponse>({
        path: `/api/v1/budgets/${budgetId}`,
        method: "PATCH",
        body: budget,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name V1InsightsAnalyticsList
     * @summary Get cost and cache analytics
     * @request GET:/api/v1/insights/analytics
     */
    v1InsightsAnalyticsList: (
      query: {
        /** Inclusive UTC start date (YYYY-MM-DD) */
        from: string;
        /**
         * Grouping dimension
         * @default "harness"
         */
        group_by?: "harness" | "model" | "wave" | "area";
        /**
         * Bucket period
         * @default "daily"
         */
        period?: "daily" | "weekly";
        /**
         * Repository UUID
         * @format uuid
         */
        repository_id?: string;
        /** Inclusive UTC end date (YYYY-MM-DD), max 366 days */
        to: string;
      },
      params: RequestParams = {},
    ) =>
      this.http.request<InsightAnalyticsResponse, ResponseErrorResponse>({
        path: `/api/v1/insights/analytics`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name V1InsightsDeliveryList
     * @summary Get delivery quality analytics
     * @request GET:/api/v1/insights/delivery
     */
    v1InsightsDeliveryList: (
      query: {
        /** Inclusive UTC start date (YYYY-MM-DD) */
        from: string;
        /**
         * Repository UUID
         * @format uuid
         */
        repository_id?: string;
        /** Inclusive UTC end date (YYYY-MM-DD), max 366 days */
        to: string;
      },
      params: RequestParams = {},
    ) =>
      this.http.request<InsightDeliveryResponse, ResponseErrorResponse>({
        path: `/api/v1/insights/delivery`,
        method: "GET",
        query: query,
        format: "json",
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
     * @name V1OrganizationInvitationsAcceptCreate
     * @summary Accept organization invitation
     * @request POST:/api/v1/organization-invitations/accept
     */
    v1OrganizationInvitationsAcceptCreate: (
      request: OrganizationAcceptInvitationRequest,
      params: RequestParams = {},
    ) =>
      this.http.request<ResponseSuccessResponse, ResponseErrorResponse>({
        path: `/api/v1/organization-invitations/accept`,
        method: "POST",
        body: request,
        type: ContentType.Json,
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
     * @name V1OrganizationsInvitationsCreate
     * @summary Create organization invitation
     * @request POST:/api/v1/organizations/{organization_id}/invitations
     */
    v1OrganizationsInvitationsCreate: (
      organizationId: string,
      request: OrganizationCreateInvitationRequest,
      params: RequestParams = {},
    ) =>
      this.http.request<ResponseSuccessResponse, ResponseErrorResponse>({
        path: `/api/v1/organizations/${organizationId}/invitations`,
        method: "POST",
        body: request,
        type: ContentType.Json,
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
     * @name V1RepositoriesCreate
     * @summary Create repository settings
     * @request POST:/api/v1/repositories
     * @secure
     */
    v1RepositoriesCreate: (
      request: RepositorysettingsCreateRequest,
      params: RequestParams = {},
    ) =>
      this.http.request<
        RepositorysettingsCreatedResponse,
        ResponseErrorResponse
      >({
        path: `/api/v1/repositories`,
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
     * @name V1RepositoriesDelete
     * @summary Delete repository settings
     * @request DELETE:/api/v1/repositories/{repository_id}
     * @secure
     */
    v1RepositoriesDelete: (repositoryId: string, params: RequestParams = {}) =>
      this.http.request<ResponseMessageResponse, ResponseErrorResponse>({
        path: `/api/v1/repositories/${repositoryId}`,
        method: "DELETE",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name V1RepositoriesDetail
     * @summary Get repository settings
     * @request GET:/api/v1/repositories/{repository_id}
     * @secure
     */
    v1RepositoriesDetail: (repositoryId: string, params: RequestParams = {}) =>
      this.http.request<RepositorysettingsViewResponse, ResponseErrorResponse>({
        path: `/api/v1/repositories/${repositoryId}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name V1RepositoriesList
     * @summary List repository settings
     * @request GET:/api/v1/repositories
     * @secure
     */
    v1RepositoriesList: (params: RequestParams = {}) =>
      this.http.request<RepositorysettingsListResponse, ResponseErrorResponse>({
        path: `/api/v1/repositories`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name V1RepositoriesPartialUpdate
     * @summary Update repository settings
     * @request PATCH:/api/v1/repositories/{repository_id}
     * @secure
     */
    v1RepositoriesPartialUpdate: (
      repositoryId: string,
      request: RepositorysettingsUpdateRequest,
      params: RequestParams = {},
    ) =>
      this.http.request<RepositorysettingsViewResponse, ResponseErrorResponse>({
        path: `/api/v1/repositories/${repositoryId}`,
        method: "PATCH",
        body: request,
        secure: true,
        type: ContentType.Json,
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
