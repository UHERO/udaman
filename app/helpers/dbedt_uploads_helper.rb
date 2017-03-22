module DbedtUploadsHelper
  def make_fa_processing_classes(status)
    if status == 'processing'
      'fa-refresh fa-spin processing'
    elsif status == 'ok'
      'fa-check ok'
    elsif status == 'fail'
      'fa-times fail'
    end
  end

  def make_fa_loading_classes(active)
    if active == 'loading'
      'fa-refresh fa-spin loading'
    elsif active == 'yes'
      'fa-dot-circle-o load-yes'
    elsif active == 'fail'
      'fa-times load-fail'
    end
  end
end
