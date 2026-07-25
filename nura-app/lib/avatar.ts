export function getAvatarUrl(seed: string) {
  const cleanSeed = seed.trim() || "Nura User";
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(cleanSeed)}&backgroundColor=e8f0e5,dde9ef,f7eadb&textColor=345c43`;
}

export function getUserAvatarUrl(user?: { email?: string | null; user_metadata?: Record<string, unknown> } | null) {
  return (user?.user_metadata?.avatar_url as string | undefined) || getAvatarUrl((user?.user_metadata?.display_name as string | undefined) || user?.email || "Nura User");
}
