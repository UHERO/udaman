module DbedtUploadsHelper
  def make_fa_polling_classes(status)
    if status == 'ok'
      return 'fa-check dbu_ok'
    else if status == 'fail'
      return 'fa-times dbu_fail'
    end
  end
end
