$ ->
  console.log "loaded data_lists coffee"
  $("a[data-remote][data-up]").on "ajax:success", (e, data, status, xhr) ->
    row = $(this).parents("tr:first")
    row.insertBefore(row.prev());
  $("a[data-remote][data-down]").on "ajax:success", (e, data, status, xhr) ->
    row = $(this).parents("tr:first")
    row.insertAfter(row.next());
  $("a[data-remote][data-remove]").on "ajax:success", (e, data, status, xhr) ->
    $(this).parents("tr:first").remove()
