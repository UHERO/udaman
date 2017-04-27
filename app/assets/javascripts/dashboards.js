$(function() {
    $("a[data-remote][data-pdpupdate]").on("ajax:success", function(e, data, status, xhr) {
        // other stuff?
        console.log("DEBUG>>>>>>>> GOT THE SUCCESS DOOD")
        $("#pdp-indicator").hide();
    });
    $("#pdp-link").click(function(){ $("#pdp-indicator").show(); });
});
