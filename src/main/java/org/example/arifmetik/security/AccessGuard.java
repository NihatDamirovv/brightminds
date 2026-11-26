package org.example.arifmetik.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayDeque;
import java.util.Base64;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.stereotype.Component;

/**
 * Kitablara giriş icazəsi (imzalı, vaxtı bitən cookie) və
 * kod/parol təxmin etməyə qarşı limit (IP üzrə).
 */
@Component
public class AccessGuard {

  /** Kitab icazəsi bu qədər müddət etibarlıdır. */
  public static final long ACCESS_TTL_MS = 2 * 60 * 60 * 1000L; // 2 saat

  private static final int MAX_FAILS = 5;
  private static final long FAIL_WINDOW_MS = 15 * 60 * 1000L; // 15 dəqiqə

  private final byte[] secret = new byte[32];
  private final Map<String, Deque<Long>> fails = new ConcurrentHashMap<>();

  public AccessGuard() {
    new SecureRandom().nextBytes(secret); // server yenidən başlayanda köhnə icazələr etibarsız olur
  }

  // ------------------------------------------------------------ kitab icazəsi cookie-si

  public static final String ACCESS_COOKIE = "bm_books";
  public static final String ACCESS_PURPOSE = "books";

  /** Kitablara 2 saatlıq icazə verən HttpOnly cookie (kod və ya admin girişindən sonra). */
  public org.springframework.http.ResponseCookie booksAccessCookie(boolean secure) {
    return org.springframework.http.ResponseCookie.from(ACCESS_COOKIE, issue(ACCESS_PURPOSE, ACCESS_TTL_MS))
        .httpOnly(true).secure(secure).sameSite("Lax").path("/api/books").build();
  }

  // ------------------------------------------------------------ imzalı icazə

  public String issue(String purpose, long ttlMs) {
    long exp = System.currentTimeMillis() + ttlMs;
    String payload = purpose + "." + exp;
    return exp + "." + sign(payload);
  }

  public boolean isValid(String purpose, String value) {
    if (value == null) return false;
    int dot = value.indexOf('.');
    if (dot <= 0) return false;
    long exp;
    try {
      exp = Long.parseLong(value.substring(0, dot));
    } catch (NumberFormatException e) {
      return false;
    }
    if (exp < System.currentTimeMillis()) return false;
    return constantEquals(sign(purpose + "." + exp), value.substring(dot + 1));
  }

  private String sign(String payload) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret, "HmacSHA256"));
      return Base64.getUrlEncoder().withoutPadding()
          .encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public static boolean constantEquals(String a, String b) {
    if (a == null || b == null) return false;
    return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
  }

  // ------------------------------------------------------------ cəhd limiti

  /** Bu IP son 15 dəqiqədə 5 dəfə səhv edibsə, true. */
  public boolean isBlocked(String key) {
    Deque<Long> q = fails.get(key);
    if (q == null) return false;
    synchronized (q) {
      prune(q);
      return q.size() >= MAX_FAILS;
    }
  }

  public void recordFail(String key) {
    Deque<Long> q = fails.computeIfAbsent(key, k -> new ArrayDeque<>());
    synchronized (q) {
      prune(q);
      q.addLast(System.currentTimeMillis());
    }
    if (fails.size() > 10_000) fails.entrySet().removeIf(e -> { synchronized (e.getValue()) { prune(e.getValue()); return e.getValue().isEmpty(); } });
  }

  public void clearFails(String key) {
    fails.remove(key);
  }

  private static void prune(Deque<Long> q) {
    long cutoff = System.currentTimeMillis() - FAIL_WINDOW_MS;
    while (!q.isEmpty() && q.peekFirst() < cutoff) q.pollFirst();
  }
}
