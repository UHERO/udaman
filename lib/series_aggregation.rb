module SeriesAggregation
  def aggregate(frequency, operation, override_prune = false)
    new_series = new_transformation("Aggregated from #{self.name}", aggregate_data_by(frequency, operation, override_prune))
    new_series.frequency = frequency
    new_series
  end
  
  def aggregate_data_by(frequency, operation, override_prune = false)
    validate_aggregation(frequency)
    
    grouped_data = group_data_by frequency, override_prune
    aggregated_data = Hash.new
    grouped_data.keys.each do |date_string|
      aggregated_data[date_string] = grouped_data[date_string].send(operation)
    end
    aggregated_data
  end
  
  def aggregate_by(frequency, operation, override_prune = false)
    aggregate(frequency, operation, override_prune)
  end
  
  # Only returns complete groups
  def group_data_by(frequency, override_prune = false)
    validate_aggregation(frequency)

    myfreq = self.frequency
    orig_series = self
    if myfreq == 'week'
      myfreq = 'day'
      orig_series = self.fill_week
    end
    agg_date_method = frequency.to_s + '_d' ## see date_extension.rb

    grouped_data = {}
    orig_series.data.keys.each do |date|
      next if orig_series.at(date).nil?
      agg_date = date.send(agg_date_method)
      grouped_data[agg_date] ||= AggregatingArray.new
      grouped_data[agg_date].push orig_series.at(date)
    end

    grouped_data.delete_if {|_,value| value.count != 6} if frequency == :semi && myfreq == 'month'
    grouped_data.delete_if {|_,value| value.count != 3} if frequency == :quarter && myfreq == 'month' && !override_prune
    grouped_data.delete_if {|_,value| value.count != 12} if frequency == :year && myfreq == 'month'
    grouped_data.delete_if {|_,value| value.count != 4} if frequency == :year && myfreq == 'quarter'
    grouped_data.delete_if {|_,value| value.count != 2} if frequency == :semi && myfreq == 'quarter'
    grouped_data.delete_if {|_,value| value.count != 2} if frequency == :year && myfreq == 'semi'
    grouped_data.delete_if {|_,value| value.count != 7} if frequency == :week && myfreq == 'day'
    grouped_data.delete_if {|key,value| value.count != key.days_in_month} if frequency == :month && myfreq == 'day'
    grouped_data
  end

  def fill_week
    raise AggregationException.new, 'fill_week: can only fill weekly series' unless self.frequency == 'week'
    dailyseries = self.data
    dailyseries.keys.each do |date|
      (1..6).each {|offset| dailyseries[date + offset] = dailyseries[date] }
    end
    dailyseries
  end

  def validate_aggregation(frequency)
    freq_order = %w[year semi quarter month week day]
    raise AggregationException.new unless freq_order.include?(frequency.to_s) && freq_order.include?(self.frequency)
    raise AggregationException.new, 'can only aggregate to a lower frequency' if freq_order.index(frequency.to_s) >= freq_order.index(self.frequency)
  end
end
