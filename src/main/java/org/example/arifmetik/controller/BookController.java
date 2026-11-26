package org.example.arifmetik.controller;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;

import org.example.arifmetik.model.Book;
import org.example.arifmetik.repository.BookRepository;
import org.example.arifmetik.security.AccessGuard;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.RequestBody;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/books")
public class BookController {

  private static final Set<String> ALLOWED_TYPES = Set.of(
      MediaType.APPLICATION_PDF_VALUE,
      MediaType.IMAGE_JPEG_VALUE,
      MediaType.IMAGE_PNG_VALUE,
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );

  private static final Set<String> INLINE_TYPES = Set.of(
      MediaType.APPLICATION_PDF_VALUE,
      MediaType.IMAGE_JPEG_VALUE,
      MediaType.IMAGE_PNG_VALUE
  );

  private final BookRepository repository;
  private final AuthController authController;
  private final AccessGuard guard;
  private final String accessCode;

  public BookController(BookRepository repository, AuthController authController, AccessGuard guard,
      @Value("${app.access.code}") String accessCode) {
    this.repository = repository;
    this.authController = authController;
    this.guard = guard;
    this.accessCode = accessCode;
  }

  public record BookSummary(Long id, String title, String author, String fileName) {
    public static BookSummary of(Book b) {
      return new BookSummary(b.getId(), b.getTitle(), b.getAuthor(), b.getFileName());
    }
  }

  // ------------------------------------------------------------------ giriş kodu
  // Kod yalnız bir dəfə POST ilə göndərilir; server əvəzində qısa müddətli, imzalı,
  // HttpOnly cookie verir. Kod heç vaxt URL-də görünmür.

  private static final String ACCESS_COOKIE = AccessGuard.ACCESS_COOKIE;
  private static final String ACCESS_PURPOSE = AccessGuard.ACCESS_PURPOSE;

  public record AccessRequest(String code) {}

  @PostMapping("/access")
  public ResponseEntity<Void> grantAccess(@RequestBody(required = false) AccessRequest req, HttpServletRequest http) {
    String key = "code:" + http.getRemoteAddr();
    if (guard.isBlocked(key)) {
      return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).header("Retry-After", "900").build();
    }
    if (req == null || !AccessGuard.constantEquals(accessCode, req.code())) {
      guard.recordFail(key);
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
    guard.clearFails(key);
    return ResponseEntity.noContent()
        .header(HttpHeaders.SET_COOKIE, guard.booksAccessCookie(http.isSecure()).toString()).build();
  }

  @DeleteMapping("/access")
  public ResponseEntity<Void> revokeAccess(HttpServletRequest http) {
    ResponseCookie cookie = ResponseCookie.from(ACCESS_COOKIE, "")
        .httpOnly(true).secure(http.isSecure()).sameSite("Lax").path("/api/books").maxAge(0).build();
    return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie.toString()).build();
  }

  private boolean hasAccess(String cookieValue) {
    return guard.isValid(ACCESS_PURPOSE, cookieValue);
  }

  // ------------------------------------------------------------------ kitablar

  @GetMapping
  public ResponseEntity<List<BookSummary>> getAll(
      @CookieValue(value = ACCESS_COOKIE, required = false) String access
  ) {
    if (!hasAccess(access)) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
    return ResponseEntity.ok(repository.findAllSummaries().stream()
        .map(s -> new BookSummary(s.getId(), s.getTitle(), s.getAuthor(), s.getFileName()))
        .toList());
  }

  @PostMapping
  public ResponseEntity<BookSummary> create(
      @RequestParam String title,
      @RequestParam(required = false) String author,
      @RequestParam MultipartFile file,
      @RequestHeader(value = "Authorization", required = false) String token
  ) throws IOException {
    if (!authController.isValidToken(token)) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }
    if (title == null || title.isBlank()) {
      return ResponseEntity.badRequest().build();
    }
    if (file == null || file.isEmpty()) {
      return ResponseEntity.badRequest().build();
    }
    if (!ALLOWED_TYPES.contains(file.getContentType())) {
      return ResponseEntity.badRequest().build();
    }

    Book book = new Book(title, author, file.getOriginalFilename(), file.getContentType(), file.getBytes());
    Book saved = repository.save(book);
    return ResponseEntity.ok(BookSummary.of(saved));
  }

  @GetMapping("/{id}/file")
  public ResponseEntity<byte[]> getFile(
      @PathVariable Long id,
      @RequestParam(required = false, defaultValue = "false") boolean download,
      @CookieValue(value = ACCESS_COOKIE, required = false) String access
  ) {
    if (!hasAccess(access)) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
    return repository.findById(id)
        .map(book -> {
          String disposition = download ? "attachment" :
              INLINE_TYPES.contains(book.getContentType()) ? "inline" : "attachment";
          return ResponseEntity.ok()
              .contentType(MediaType.parseMediaType(book.getContentType()))
              .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.builder(disposition)
                  .filename(book.getFileName() == null ? "kitab" : book.getFileName(), StandardCharsets.UTF_8)
                  .build().toString())
              .header(HttpHeaders.CACHE_CONTROL, "no-store, private")
              .body(book.getFileData());
        })
        .orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(
      @PathVariable Long id,
      @RequestHeader(value = "Authorization", required = false) String token
  ) {
    if (!authController.isValidToken(token)) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }
    if (!repository.existsById(id)) {
      return ResponseEntity.notFound().build();
    }
    repository.deleteById(id);
    return ResponseEntity.noContent().build();
  }
}
