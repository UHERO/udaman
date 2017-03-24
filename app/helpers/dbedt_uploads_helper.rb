module DbedtUploadsHelper
  def make_fa_processing_classes(status)
    case status
      when 'processing'
        'fa-refresh fa-spin processing'
      when 'ok'
        'fa-check ok'
      when 'fail'
        'fa-times fail'
      else
        puts "unknown processing status: #{status}"
        'fa-times'
    end
  end

  def make_fa_loading_classes(active)
    if active == 'loading'
      'fa-refresh fa-spin loading'
    elsif active == 'yes'
      'fa-dot-circle-o load-yes'
    elsif active == 'no'
      'fa-circle-o load-no'
    elsif active == 'fail'
      'fa-times load-fail'
    end
  end
end
