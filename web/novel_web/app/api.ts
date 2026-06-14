export const authStorageKey = "novels_ai_gen_auth";

// AuthData 表示登录接口成功返回的令牌数据。
export interface AuthData {
  // token 表示后续访问系统资源使用的 Bearer 令牌。
  token: string;
  // token_type 表示令牌类型，后端固定返回 Bearer。
  token_type: string;
  // expires_at 表示令牌过期时间。
  expires_at: string;
}

// ApiResponse 表示后端统一响应结构。
export interface ApiResponse<TData> {
  // code 表示业务响应码，成功时为 0。
  code: number;
  // message 表示后端返回的用户提示信息。
  message: string;
  // data 表示接口成功返回的数据内容。
  data?: TData;
}

// NovelItem 表示书架中的小说条目。
export interface NovelItem {
  // id 表示小说主键 ID。
  id: number;
  // name 表示小说名。
  name: string;
  // author_name 表示作者名。
  author_name: string;
  // description 表示小说简介。
  description: string;
  // tags 表示英文逗号分隔的标签文本。
  tags: string;
  // cover_url 表示小说封面链接。
  cover_url: string;
  // created_at 表示小说创建时间。
  created_at: string;
  // updated_at 表示小说更新时间。
  updated_at: string;
}

// NovelListData 表示小说列表分页数据。
export interface NovelListData {
  // items 表示当前页小说列表。
  items: NovelItem[];
  // total 表示符合条件的小说总数。
  total: number;
  // page 表示当前页码。
  page: number;
  // page_size 表示每页数量。
  page_size: number;
}

// NovelListParams 表示查询小说列表时使用的分页参数。
export interface NovelListParams {
  // page 表示当前页码，从 1 开始。
  page: number;
  // pageSize 表示每页数量。
  pageSize: number;
  // signal 表示用于取消请求的浏览器 AbortSignal。
  signal?: AbortSignal;
}

// UnauthorizedError 表示前端检测到登录态不存在或已失效。
export class UnauthorizedError extends Error {
  // constructor 创建未授权错误。
  // 参数 message 表示需要展示给用户的错误提示。
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

// loginWithPassword 调用后端登录接口并返回令牌数据。
// 参数 password 表示用户输入的系统登录密码。
export async function loginWithPassword(password: string): Promise<AuthData> {
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });

  const payload = await parseApiResponse<AuthData>(response);

  if (!response.ok || !payload?.data?.token) {
    throw new Error(payload?.message || "登录失败，请稍后再试");
  }

  return payload.data;
}

// persistAuthData 将登录令牌保存到浏览器本地存储中。
// 参数 data 表示登录接口返回的令牌数据。
export function persistAuthData(data: AuthData) {
  window.localStorage.setItem(authStorageKey, JSON.stringify(data));
}

// clearAuthData 清理浏览器本地保存的登录令牌。
export function clearAuthData() {
  window.localStorage.removeItem(authStorageKey);
}

// readAuthData 从浏览器本地存储读取未过期的登录令牌。
export function readAuthData(): AuthData | null {
  const rawValue = window.localStorage.getItem(authStorageKey);
  if (!rawValue) {
    return null;
  }

  const value = parseStoredAuthData(rawValue);
  if (!value || isExpiredAuthData(value)) {
    clearAuthData();
    return null;
  }

  return value;
}

// fetchNovelList 查询当前用户可访问的小说列表。
// 参数 params 表示小说列表分页查询参数。
export async function fetchNovelList(
  params: NovelListParams,
): Promise<NovelListData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const searchParams = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
  });
  const response = await fetch(`/api/v1/novels?${searchParams.toString()}`, {
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
    signal: params.signal,
  });
  const payload = await parseApiResponse<NovelListData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "书架加载失败，请稍后再试");
  }

  return payload.data;
}

// parseStoredAuthData 解析本地存储中的登录令牌。
// 参数 rawValue 表示 localStorage 中的原始字符串。
function parseStoredAuthData(rawValue: string): AuthData | null {
  try {
    const value = JSON.parse(rawValue) as unknown;
    if (isAuthData(value)) {
      return value;
    }
  } catch {
    return null;
  }
  return null;
}

// isAuthData 判断未知数据是否符合登录令牌结构。
// 参数 value 表示需要判断的未知数据。
function isAuthData(value: unknown): value is AuthData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = value as Record<string, unknown>;
  return (
    typeof data.token === "string" &&
    typeof data.token_type === "string" &&
    typeof data.expires_at === "string"
  );
}

// isExpiredAuthData 判断登录令牌是否已经过期。
// 参数 data 表示本地保存的登录令牌。
function isExpiredAuthData(data: AuthData): boolean {
  const expiresAt = new Date(data.expires_at).getTime();
  if (Number.isNaN(expiresAt)) {
    return true;
  }
  return Date.now() >= expiresAt;
}

// formatAuthorizationHeader 生成后端鉴权需要的 Authorization 请求头。
// 参数 data 表示登录接口返回的令牌数据。
function formatAuthorizationHeader(data: AuthData): string {
  const tokenType = data.token_type.trim() || "Bearer";
  return `${tokenType} ${data.token}`;
}

// parseApiResponse 解析后端统一响应结构。
// 参数 response 表示 fetch 返回的 HTTP 响应对象。
async function parseApiResponse<TData>(
  response: Response,
): Promise<ApiResponse<TData> | null> {
  return (await response.json().catch(() => null)) as ApiResponse<TData> | null;
}
