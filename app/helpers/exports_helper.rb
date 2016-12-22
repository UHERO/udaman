module ExportsHelper
  def exports_csv_helper
    CSV.generate do |csv|
      series_data = @export.series_data
      names = @export.series.pluck :name
      dates_array = @export.data_dates
      csv << ['date'] + names
      dates_array.each do |date|
        csv << [date] + names.map {|series_name| series_data[series_name][date]}
      end
    end
  end
end
