"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabaseClient";
import type { User } from "@supabase/supabase-js";

/**
 * useAuth Hook
 * Returns the current user and loading state.
 * Optionally redirects to a target page if user meets a condition.
 */
export function useAuth(options?: {
  redirectTo?: string;
  redirectIf?: (user: User | null) => boolean;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Get current session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        setUser(session?.user || null);

        // Handle redirect logic if specified
        if (options?.redirectIf && options?.redirectTo) {
          if (options.redirectIf(session?.user || null)) {
            router.push(options.redirectTo);
          }
        }
      } catch (error) {
        console.error("[useAuth] Failed to check auth:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription?.unsubscribe();
  }, [options, router]);

  return { user, loading };
}

/**
 * Extract display name from user metadata or email
 * Fallback to email if name not available
 */
export function getUserDisplayName(user: User | null): string {
  if (!user) return "User";

  // Try to get name from user metadata
  const metadata = user.user_metadata as Record<string, any> | undefined;
  if (metadata?.first_name) {
    return metadata.first_name;
  }

  // Fallback to email username
  const emailPart = user.email?.split("@")[0];
  if (emailPart) return emailPart;

  return "User";
}

/**
 * useProtectedRoute Hook
 * Ensures user is authenticated, redirects to /login if not.
 */
export function useProtectedRoute() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          router.push("/login");
          return;
        }

        setUser(session.user);
      } catch (error) {
        console.error("[useProtectedRoute] Auth check failed:", error);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.push("/login");
        return;
      }
      setUser(session.user);
    });

    return () => subscription?.unsubscribe();
  }, [router]);

  return { user, loading };
}
