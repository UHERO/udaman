module SeriesStatistics

  def sum
    num_array = (self.data.sort.reject{|a| a[1].nil?}).map { |a| a[1]}
    num_array.inject(0, :+){ | sum, x | sum + x }
  end

  def average
    observation_count > 0 ? sum / observation_count : 0
  end

  def variance
    # m = self.mean
    num_array = self.data.sort.map { |a| a[1]}
    sum_var = num_array.inject(0){ | sum, x | sum + (x - average) ** 2 }
    sum_var / (self.observation_count - 1 )
  end

  def standard_deviation
    Math.sqrt(self.variance)
  end

  def median
    num_array = (self.data.reject{|a| a.nil?}).map { |a| a[1]}.sort
    return nil if num_array.empty?
    median_index = num_array.size / 2
    num_array.size % 2 == 1 ? num_array[median_index] : (num_array[median_index - 1] + num_array[median_index]) / 2.0
  end

  def outlier
    begin
      outlier_hash = {}
      ma = moving_average = self.moving_average

      all_dates = self.data.keys | ma.data.keys
      # residuals = []
      # all_dates.each do |date_string|
      #   ma_point = ma.data[date_string].nil? ? nil : ma.data[date_string]
      #   residual = ma.data[date_string].nil? ? nil : ma.data[date_string] - self.data[date_string]
      #   residuals.push(ma_point) unless ma_point.nil?
      # end

      residuals = (self.data.reject {|date, d| d.nil? }).map { |date, d| d }
      average = residuals.inject{ |sum, el| sum + el }.to_f / residuals.count
      std_dev = Math.sqrt((residuals.inject(0){ | sum, x | sum + (x - average) ** 2 }) / (residuals.count - 1))

      mult = 6
      self.data.each do |date_string, val|
        next if moving_average.data[date_string].nil?
        upper = moving_average.data[date_string] + mult * std_dev
        lower = moving_average.data[date_string] - mult * std_dev
        outlier_hash[date_string] = val unless (lower..upper).include? val
      end
      outlier_hash
    rescue
      #puts "-error: #{self.name}---------"
      return nil
    end
  end

end
