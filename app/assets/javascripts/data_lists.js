$(function() {
  $("a[data-remote][data-up]").on("ajax:success", function(e, data, status, xhr) {
    var row = $(this).parents("tr:first");
    row.insertBefore(row.prev());
  });
  
  $("a[data-remote][data-down]").on("ajax:success", function(e, data, status, xhr) {
    var row = $(this).parents("tr:first");
    row.insertAfter(row.next());
  });
  
  $("a[data-remote][data-remove]").on("ajax:success", function(e, data, status, xhr) {
    $(this).parents("tr:first").remove();
  });
  
  $("a[data-remote][data-indent]").on("ajax:success", function(e, data, status, xhr) {
    $(this).parents("tr:first").find("td span.indentation").html(data.the_indent);
  });
});