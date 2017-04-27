$(function() {
    $("a[data-remote][data-pdpupdate]").on("ajax:success", function(e, data, status, xhr) {
        $("#pdp-indicator").hide();
    });
    $("#pdp-link").click(function(){ $("#pdp-indicator").show(); });
});
