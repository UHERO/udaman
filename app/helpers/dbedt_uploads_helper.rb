module DbedtUploadsHelper
  def make_fa_polling_classes(status)
    if status == 'processing'
      'fa-refresh fa-spin processing'
    elsif status == 'ok'
      'fa-check ok'
    elsif status == 'fail'
      'fa-times fail'
    end
  end
end
