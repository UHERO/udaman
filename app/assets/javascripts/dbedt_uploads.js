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
                    $(element).removeClass('processing fa-spinner fa-pulse').addClass('ok fa-check');
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
                    $(element).removeClass('processing fa-spinner fa-pulse').addClass('fail fa-times');
                    if ($('.upload-status.processing').length == 0) {
                        $('.controls').show();
                    }
                    clearInterval(intervalId);
                }
            });
        }
    });
});
