export interface GithubInstallationTokenResponse {
  token: string;
  expires_at: string;
}

export interface GithubInstallationRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    login: string;
  };
}

export interface GithubInstallationRepositoriesResponse {
  total_count: number;
  repositories: GithubInstallationRepo[];
}
