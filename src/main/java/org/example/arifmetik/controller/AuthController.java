package org.example.arifmetik.controller;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.example.arifmetik.security.AccessGuard;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

  private static final long TOKEN_TTL_MS = 8 * 60 * 60 * 1000L; // admin girişi 8 saat etibarlıdır

  private final String adminUsername;
  private final String adminPassword;
  private final AccessGuard guard;
  /** token -> bitmə vaxtı */
  private final Map<String, Long> tokens = new ConcurrentHashMap<>();

  public AuthController(
      @Value("${app.admin.username}") String adminUsername,
      @Value("${app.admin.password}") String adminPassword,
      AccessGuard guard) {
    this.adminUsername = adminUsername;
    this.adminPassword = adminPassword;
    this.guard = guard;
  }

  public record LoginRequest(String username, String password) {}
  public record LoginResponse(String token) {}

  @PostMapping("/login")
  public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest req, HttpServletRequest http) {
    String key = "login:" + http.getRemoteAddr();
    if (guard.isBlocked(key)) {
      return ResponseEntity.status(429).header("Retry-After", "900").build();
    }
    boolean ok = req != null
        & AccessGuard.constantEquals(adminUsername, req == null ? null : req.username())
        & AccessGuard.constantEquals(adminPassword, req == null ? null : req.password());
    if (!ok) {
      guard.recordFail(key);
      return ResponseEntity.status(401).build();
    }
    guard.clearFails(key);
    tokens.entrySet().removeIf(e -> e.getValue() < System.currentTimeMillis());
    String token = UUID.randomUUID().toString();
    tokens.put(token, System.currentTimeMillis() + TOKEN_TTL_MS);
    // Admin kitab kodunu ayrıca yazmadan kitabları görür
    return ResponseEntity.ok()
        .header(org.springframework.http.HttpHeaders.SET_COOKIE, guard.booksAccessCookie(http.isSecure()).toString())
        .body(new LoginResponse(token));
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(@RequestBody Map<String, String> body) {
    if (body != null && body.get("token") != null) tokens.remove(body.get("token"));
    return ResponseEntity.noContent().build();
  }

  public boolean isValidToken(String token) {
    if (token == null) return false;
    Long exp = tokens.get(token);
    if (exp == null) return false;
    if (exp < System.currentTimeMillis()) {
      tokens.remove(token);
      return false;
    }
    return true;
  }
}
