module DbedtUploadsHelper
  def make_fa_processing_classes(status)
    case status
      when 'processing'
        'fa-spinner fa-pulse processing'
      when 'ok'
        'fa-check ok'
      when 'fail'
        'fa-times fail'
      else
        'fa-times'
    end
  end

### this looks like vestigial code -- commenting out now, delete later
#  def make_fa_loading_classes(active)
#    if active == 'loading'
#      'fa-spinner fa-pulse loading'
#    elsif active == 'yes'
#      'fa-dot-circle load-yes'
#    elsif active == 'no'
#      'fa-circle load-no'
#    elsif active == 'fail'
#      'fa-times load-fail'
#    end
#  end

  def now_processing?(cls)
     ## true if anything is currently in processing
    !cls.where(%q(cats_status = 'processing' or series_status = 'processing')).empty?
  end
end
