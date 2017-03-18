module DbedtLoadSeries
  require 'csv'

  def load_series_csv(path)
    current_series = nil
    CSV.foreach(path, {col_sep: "\t", headers: true, return_headers: false}) do |row|
      this_series = nil
      name = 'DBEDT_' + row[0] + '@' + get_geo_code(row[3]) + '.' + row[4]

      if current_series.nil? || name != current_series
        ## We've found beginning of next series, so create a new Series record
        current_series = name
        this_series = Series.new(
            :name => name,
            :frequency => row[4],
            :description => row[1],
            :dataPortalName => row[1],
            :unitsLabel => row[8],
            :source => Source.get_or_new_dbedt(row[9]),
        )
        this_series.save  ## Check
      end
      ## add observation to current series as a data point. what about :current?
      #puts ">>> >> New DP: date=#{DbedtSeriesLoad.get_date(row[5], row[6])}, value=#{row[7]}"
      this_series.data_points.create(date: get_date(row[5], row[6]), value: row[7])
    end
  end

  def get_geo_code(name)
    trans_hash = {
      'Hawaii County' => 'HAW',
      'Honolulu County' => 'HON',
      'Maui County' => 'MAU',
      'Kauai County' => 'KAU',
      'Statewide' => 'HI',
    }
    trans_hash[name] || 'ERROR'
  end

  def get_date(year, qm)
    if qm =~ /^M(\d+)/i
      "#{year}-#{$1}-01"
    elsif qm =~ /^Q(\d+)/i
      quarter_month = '%02d' % (($1.to_i - 1) * 3 + 1)
      "#{year}-#{quarter_month}-01"
    elsif qm.nil? || qm.empty? || qm =~ /A/i
      "#{year}-01-01"
    else
      "#{year}-12-31"  ## use this as an error code? :=}
    end
  end

end
