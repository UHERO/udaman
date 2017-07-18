$(function() {
    $('.upload-status.processing').each(function(_, element) {
        var icon_args = $(element).attr('id').split('-');
        var resource = icon_args[0];
        var upload_type = icon_args[1];
        var upload_id = icon_args[2];
        var intervalId = setInterval(updateClass, 2000);
        function updateClass() {
            $.get('/' + resource + '_uploads/' + upload_id + '/status/' + upload_type, function(data) {
                if (data === 'processing') {
                    // no update needed since the class is already set to processing
                    return;
                }
                if (data === 'ok') {
                    $(element).removeClass('processing fa-refresh fa-spin').addClass('ok fa-check');
                    if (resource === 'nta') {
                        location.reload();
                    }
                    else if ($(element).parent().siblings().has('i.fa-check').length === 1) {
                        $(element).parent().siblings().has('span.waiting').children('span').removeClass('waiting');
                        location.reload();
                    }
                    if ($('.upload-status.processing').length == 0) {
                        $('.controls').show();
                    }
                    clearInterval(intervalId);
                    return;
                }
                if (data === 'fail') {
                    $(element).removeClass('processing fa-refresh fa-spin').addClass('fail fa-times');
                    if ($('.upload-status.processing').length == 0) {
                        $('.controls').show();
                    }
                    clearInterval(intervalId);
                }
            });
        }
    });
    /* *** THIS IS UNUSED CODE
    $('.load-status.loading').each(function(_, element) {
        var icon_args = $(element).attr('id').split('-');
        var resource = icon_args[0];
        var upload_id = icon_args[1];
        var intervalId = setInterval(updateClass, 2000);  // Check once every 2 seconds
        function updateClass() {
            // TODO: send request to the right url
            $.get('/' + resource + '_uploads/' + upload_id + '/active_status', function(data) {
                // data should be the content you deliver from the status endpoint
                if (data === 'loading') {
                    // no update needed since the class is already set to processing
                    return;
                }
                if (data === 'yes') {
                    $(element).removeClass('loading fa-refresh fa-spin').addClass('load-yes fa-dot-circle-o');
                    clearInterval(intervalId);
                    return;
                }
                if (data === 'fail') {
                    $(element).removeClass('loading fa-refresh fa-spin').addClass('load-fail fa-times');
                    clearInterval(intervalId);
                }
            });
        }
    });
    */
});
