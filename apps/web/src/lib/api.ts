const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export class APIError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.data = data;
  }
}
function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("nexusdocs_token");
}
export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem("nexusdocs_token", token);
  } else {
    localStorage.removeItem("nexusdocs_token");
  }
}
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>)
  };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include" // for HttpOnly cookies
  });

  if (!response.ok) {
    let errorDetail = "An error occurred";
    let data = null;
    try {
      data = await response.json();
      const detail = data.detail || data.message;
      errorDetail = typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((item: any) => item.msg || "Invalid input").join("; ") : "The request could not be completed. Please try again.";
    } catch {
      errorDetail = response.statusText;
    }
    throw new APIError(errorDetail, response.status, data);
  }
  // Handle empty responses
  if (response.status === 204) {
    return ({} as T);
  }
  return response.json();
}
export const api = {
  // Auth
  async login(payload: {
    email: string;
    password: string;
  }) {
    const res = await request<any>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    if (res.access_token) {
      setStoredToken(res.access_token);
    }
    return res;
  },
  async register(payload: {
    email: string;
    password: string;
    display_name: string;
  }) {
    const res = await request<any>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    if (res.access_token) {
      setStoredToken(res.access_token);
    }
    return res;
  },
  async logout() {
    try {
      await request("/api/v1/auth/logout", {
        method: "POST"
      });
    } finally {
      setStoredToken(null);
    }
  },
  async getMe() {
    return request<any>("/api/v1/me");
  },
  // Workspaces
  async listWorkspaces() {
    return request<any[]>("/api/v1/workspaces");
  },
  async createWorkspace(payload: {
    name: string;
    description?: string;
  }) {
    return request<any>("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async getWorkspace(id: string) {
    return request<any>(`/api/v1/workspaces/${id}`);
  },
  async updateWorkspace(id: string, payload: {
    name?: string;
    description?: string;
  }) {
    return request<any>(`/api/v1/workspaces/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  async listWorkspaceMembers(id: string) {
    return request<any[]>(`/api/v1/workspaces/${id}/members`);
  },
  async addWorkspaceMember(id: string, payload: {
    email: string;
    role: string;
  }) {
    return request<any>(`/api/v1/workspaces/${id}/members`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async removeWorkspaceMember(id: string, userId: string) {
    return request<any>(`/api/v1/workspaces/${id}/members/${userId}`, {
      method: "DELETE"
    });
  },
  // Documents
  async listDocuments(workspaceId: string, params?: {
    search?: string;
    tag?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.tag) query.set("tag", params.tag);
    return request<any[]>(`/api/v1/workspaces/${workspaceId}/documents?${query.toString()}`);
  },
  async createDocument(workspaceId: string, payload: {
    title: string;
    markdown: string;
    tags?: string[];
  }) {
    return request<any>(`/api/v1/workspaces/${workspaceId}/documents`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async getDocument(docId: string) {
    return request<any>(`/api/v1/documents/${docId}`);
  },
  async updateDocument(docId: string, payload: {
    title?: string;
    markdown?: string;
    tags?: string[];
    status?: string;
  }) {
    return request<any>(`/api/v1/documents/${docId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  async deleteDocument(docId: string) {
    return request<any>(`/api/v1/documents/${docId}`, {
      method: "DELETE"
    });
  },
  async restoreDocument(docId: string) {
    return request<any>(`/api/v1/documents/${docId}/restore`, {
      method: "POST"
    });
  },
  async listRevisions(docId: string) {
    return request<any[]>(`/api/v1/documents/${docId}/revisions`);
  },
  async restoreRevision(docId: string, revisionId: string) {
    return request<any>(`/api/v1/documents/${docId}/revisions/${revisionId}/restore`, {
      method: "POST"
    });
  },
  async importMarkdownFiles(workspaceId: string, files: File[]) {
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }
    return request<any>(`/api/v1/workspaces/${workspaceId}/imports/markdown`, {
      method: "POST",
      body: formData
    });
  },
  // Search
  async search(workspaceId: string, params: {
    q: string;
    mode?: string;
    tags?: string[];
    limit?: number;
  }) {
    const query = new URLSearchParams();
    query.set("q", params.q);
    if (params.mode) query.set("mode", params.mode);
    if (params.limit) query.set("limit", params.limit.toString());
    if (params.tags) {
      params.tags.forEach(t => query.append("tags", t));
    }
    return request<any>(`/api/v1/workspaces/${workspaceId}/search?${query.toString()}`);
  },
  // Graph
  async getGraph(workspaceId: string, params?: {
    includeTags?: boolean;
    includeWikiLinks?: boolean;
    includeSemanticEdges?: boolean;
    minSimilarity?: number;
    selectedTag?: string;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.includeTags !== undefined) query.set("include_tags", String(params.includeTags));
    if (params?.includeWikiLinks !== undefined) query.set("include_wiki_links", String(params.includeWikiLinks));
    if (params?.includeSemanticEdges !== undefined) query.set("include_semantic_edges", String(params.includeSemanticEdges));
    if (params?.minSimilarity !== undefined) query.set("min_similarity", String(params.minSimilarity));
    if (params?.selectedTag) query.set("selected_tag", params.selectedTag);
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    return request<any>(`/api/v1/workspaces/${workspaceId}/graph?${query.toString()}`);
  },
  // RAG
  async ask(workspaceId: string, payload: {
    question: string;
    tags?: string[];
    document_ids?: string[];
  }) {
    return request<any>(`/api/v1/workspaces/${workspaceId}/ask`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  // Jobs
  async getJob(jobId: string) {
    return request<any>(`/api/v1/jobs/${jobId}`);
  }
};
