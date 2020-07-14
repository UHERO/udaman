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

  ## true if anything is currently in processing
  def now_processing?(cls, cols: [:cats_status, :series_status])
    !cls.where(cols.map {|c| "#{c} = 'processing'" }.join(' or ')).empty?
  end
end
