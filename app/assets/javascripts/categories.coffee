$ ->
  $("a[data-remote][data-hide]").on "ajax:success", (e, data, status, xhr) ->
    $(this).find("span.hidden_cat_label").show()
  $("a[data-remote][data-unhide]").on "ajax:success", (e, data, status, xhr) ->
    $(this).find("span.hidden_cat_label").hide()
