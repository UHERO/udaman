#!/usr/bin/env Rscript
# Generates r-fixtures.json from the R reference implementation.
#
# Run against the pinned upstream commit (see ../../README.md):
#   git clone https://github.com/cynkra/tempdisagg && cd tempdisagg
#   git checkout <pinned-sha> && R CMD INSTALL .
#   Rscript generate-fixtures.R > r-fixtures.json
#
# Uses td()'s numeric mode (plain vectors, `to = ratio`) so no ts/date
# machinery is involved — exactly the surface the JS port exposes.

suppressPackageStartupMessages({ library(tempdisagg); library(jsonlite) })

set.seed(20260826)

methods <- c("denton", "denton-cholette", "uniform",
             "chow-lin-maxlog", "chow-lin-fixed",
             "litterman-maxlog", "litterman-fixed", "fernandez", "ols")
conversions <- c("sum", "average", "first", "last")

make_data <- function(n_l, ratio, n_fc = 0, k = 1) {
  n <- n_l * ratio + n_fc
  X <- sapply(seq_len(k), function(j) {
    100 + 10 * j + cumsum(rnorm(n, 0.3, 2)) + 5 * sin(2 * pi * seq_len(n) / ratio)
  })
  X <- matrix(X, ncol = k)
  hf <- 1.5 * X[, 1] + (if (k > 1) 0.7 * X[, 2] else 0) + rnorm(n, 0, 4) + 20
  y <- as.numeric(CalcC <- tempdisagg:::CalcC(n_l, "sum", ratio, 0, n_fc) %*% hf)
  list(y = y, X = X)
}

cases <- list()
add_case <- function(spec, fn) {
  res <- tryCatch(
    suppressMessages(suppressWarnings(fn())),
    error = function(e) NULL
  )
  if (is.null(res)) return(invisible())
  out <- list(
    values = as.numeric(res$values),
    fitted = as.numeric(res$fitted.values),
    residuals = as.numeric(res$residuals),
    preliminary = as.numeric(res$p)
  )
  if (!is.null(res$rho)) {
    out$rho <- res$rho
    out$truncated <- res$truncated
    out$coefficients <- as.numeric(res$coefficients)
    out$se <- as.numeric(res$se)
    out$rss <- res$rss; out$tss <- res$tss
    out$logl <- res$logl; out$aic <- res$aic; out$bic <- res$bic
    out$r2 <- res$r.squared; out$adjR2 <- res$adj.r.squared
  }
  cases[[length(cases) + 1]] <<- c(spec, list(expected = out))
}

for (method in methods) {
  is_denton <- method %in% c("denton", "denton-cholette", "uniform")
  for (conversion in conversions) {
    for (n_l in c(6, 12, 25)) {
      for (ratio in c(3, 4)) {
        if (n_l == 25 && ratio == 3) next  # keep the corpus a sane size
        if (is_denton) {
          hs <- if (method == "uniform") 0 else 0:3
          crits <- if (method == "uniform") "additive" else c("additive", "proportional")
          for (h in hs) for (criterion in crits) {
            if (h > 1 && n_l == 25) next
            d <- make_data(n_l, ratio)
            y <- d$y; x <- d$X[, 1]
            add_case(
              list(method = method, conversion = conversion, ratio = ratio,
                   h = h, criterion = criterion, y = y, indicator = list(x), intercept = FALSE),
              function() td(y ~ 0 + x, to = ratio, method = method, conversion = conversion,
                            criterion = criterion, h = h))
          }
          # no-indicator variant
          d <- make_data(n_l, ratio)
          y <- d$y
          add_case(
            list(method = method, conversion = conversion, ratio = ratio,
                 h = 1, criterion = "proportional", y = y),
            function() td(y ~ 1, to = ratio, method = method, conversion = conversion,
                          criterion = "proportional", h = 1))
        } else {
          rhos <- if (grepl("fixed", method)) c(-0.5, 0, 0.5, 0.9, 0.99) else 0.5
          truncs <- if (grepl("maxlog", method)) c(0, -1) else 0
          for (fixed_rho in rhos) for (trunc in truncs) {
            # one indicator + intercept
            d <- make_data(n_l, ratio)
            y <- d$y; x <- d$X[, 1]
            add_case(
              list(method = method, conversion = conversion, ratio = ratio,
                   fixedRho = fixed_rho, truncatedRho = trunc,
                   y = y, indicator = list(x), intercept = TRUE),
              function() td(y ~ x, to = ratio, method = method, conversion = conversion,
                            fixed.rho = fixed_rho, truncated.rho = trunc))
            # one indicator, no intercept
            add_case(
              list(method = method, conversion = conversion, ratio = ratio,
                   fixedRho = fixed_rho, truncatedRho = trunc,
                   y = y, indicator = list(x), intercept = FALSE),
              function() td(y ~ 0 + x, to = ratio, method = method, conversion = conversion,
                            fixed.rho = fixed_rho, truncated.rho = trunc))
          }
          # two indicators + intercept, with a 5-period forecast tail
          d <- make_data(n_l, ratio, n_fc = 5, k = 2)
          y <- d$y; x1 <- d$X[, 1]; x2 <- d$X[, 2]
          add_case(
            list(method = method, conversion = conversion, ratio = ratio,
                 fixedRho = 0.5, truncatedRho = 0,
                 y = y, indicator = list(x1, x2), intercept = TRUE),
            function() td(y ~ x1 + x2, to = ratio, method = method, conversion = conversion,
                          fixed.rho = 0.5, truncated.rho = 0))
          # intercept only (no indicator)
          d <- make_data(n_l, ratio)
          y <- d$y
          add_case(
            list(method = method, conversion = conversion, ratio = ratio,
                 fixedRho = 0.5, truncatedRho = 0, y = y, intercept = TRUE),
            function() td(y ~ 1, to = ratio, method = method, conversion = conversion,
                          fixed.rho = 0.5, truncated.rho = 0))
        }
      }
    }
  }
}

meta <- list(
  package = "tempdisagg",
  version = as.character(packageVersion("tempdisagg")),
  r = R.version.string,
  nCases = length(cases)
)
cat(toJSON(list(meta = meta, cases = cases), digits = NA, auto_unbox = TRUE, pretty = FALSE))
