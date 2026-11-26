package org.example.arifmetik.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Saytın bölmələrinin öz ünvanları var (məs. /contact).
 * Bu ünvanlar birbaşa açılanda və ya səhifə yenilənəndə eyni index.html verilir,
 * hansı bölmənin göstəriləcəyini isə js/app.js ünvana baxıb seçir.
 */
@Controller
public class PageController {

  @GetMapping({"/mental", "/books", "/about", "/contact",
               "/mental/", "/books/", "/about/", "/contact/"})
  public String page() {
    return "forward:/index.html";
  }
}
