module ExportsHelper
  def exports_csv_helper
    CSV.generate do |csv|
      names = @export.export_series.order(:list_order).map {|es| es.series.name }
      data = @export.series_data
      csv << ['date'] + names
      @export.data_dates.each do |date|
        csv << [date] + names.map {|series_name| data[series_name][date] rescue nil }
      end
    end
  end

  def sorthead(head)
    return head unless @sortby.downcase == head.downcase
    "#{head} <i class='fas fa-angle-#{@dir}' aria-hidden='true'></i>".html_safe
  end

  def sortdir(head)
    return 'up' unless @sortby.downcase == head.downcase
    @dir == 'up' ? 'down' : 'up'
  end
end
