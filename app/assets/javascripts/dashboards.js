$(function() {
    $("a[data-remote][data-pdpupdate]").on("ajax:success", function(e, data, status, xhr) {
        $("#pdp-indicator").removeClass('fa-refresh fa-spin').addClass('fa-check');
    });
    $("#pdp-link").click(function(){ $("#pdp-indicator-span").show(); });
});
