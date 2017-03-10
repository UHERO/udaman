module DbedtSeriesLoad
  require 'csv'

  def slurp_csv(path)
    current_ind_id = 0
    CSV.open(path, {col_sep: "\t", headers: true, return_headers: false}) do |row|
      if current_ind_id == 0 || row[0].to_i != current_ind_id
        current_ind_id = row[0].to_i
        name = "DBEDT_#{current_ind_id}@#{get_geo_code(row[3])}.#{row[4]}"
        this_series = Series.new(
            :name => name,
            :frequency => row[4],
            :description => row[1],
            :dataPortalName => row[1],
            :unitsLabel => row[8],
        )
        this_series.save  ## Check
      end
      ## add observation to current series as a data point. what about :current?
      this_series.data_points.create(:date => get_date(row[5], row[6]), :value => row[7])
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
    if qm.empty? || qm == 'A'
      "#{year}-01-01"
    elsif qm =~ /^M(\d+)/
      "#{year}-#{$1}-01"
    elsif qm =~ /^Q(\d+)/
      quarter_month = '%02d' % ($1 - 1) * 3 + 1
      "#{year}-#{quarter_month}-01"
    else
      "#{year}-12-31"  ## use this as an error code? :=}
    end
  end

end