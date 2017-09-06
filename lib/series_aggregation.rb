module SeriesAggregation
  def aggregate(frequency, operation, override_prune = false)
    new_series = new_transformation("Aggregated from #{self.name}", aggregate_data_by(frequency, operation, override_prune))
    new_series.frequency = frequency
    new_series
  end
  
  def aggregate_data_by(frequency,operation, override_prune = false)
    validate_aggregation(frequency)
    
    grouped_data = group_data_by frequency, override_prune
    aggregated_data = Hash.new
    grouped_data.keys.each do |date_string|
      aggregated_data[date_string] = grouped_data[date_string].send(operation)
    end
    aggregated_data
  end
  
  def aggregate_by(frequency,operation, override_prune = false)
    aggregate(frequency, operation, override_prune)
  end
  
  # Only returns complete groups
  def group_data_by(frequency, override_prune = false)
    validate_aggregation(frequency)
    
    aggregated_data = Hash.new
    frequency_method = frequency.to_s + '_d'
    
    self.data.keys.each do |date|
      next if self.at(date).nil?
      aggregated_data[date.send(frequency_method)] ||= AggregatingArray.new
      aggregated_data[date.send(frequency_method)].push self.at(date)
    end

    freq = self.frequency.to_s

    aggregated_data.delete_if {|_,value| value.count != 6} if frequency == :semi and freq == 'month'
    aggregated_data.delete_if {|_,value| value.count != 3} if (frequency == :quarter and freq == 'month') and override_prune == false
    aggregated_data.delete_if {|_,value| value.count != 12} if frequency == :year and freq == 'month'
    aggregated_data.delete_if {|_,value| value.count != 4} if frequency == :year and freq == 'quarter'
    aggregated_data.delete_if {|_,value| value.count != 2} if frequency == :semi and freq == 'quarter'
    aggregated_data.delete_if {|_,value| value.count != 2} if frequency == :year and freq == 'semi'
    aggregated_data.delete_if {|key,value| value.count != key.days_in_month} if frequency == :month and freq == 'day'
    aggregated_data
  end
  
  def validate_aggregation(frequency)
    freq_order = %w[year semi quarter month week day]
    raise AggregationException.new unless freq_order.include? frequency
    raise AggregationException.new unless %w[year semi quarter month day].include? self.frequency
    raise AggregationException.new if freq_order.index(frequency.to_s) >= freq_order.index(self.frequency)
    #raise AggregationException.new if freq == 'year'
    #raise AggregationException.new if freq == 'semi'  and (frequency == :month or frequency == :quarter or frequency == :semi or frequency == :week or frequency == :day)
    #raise AggregationException.new if freq == 'quarter' and (frequency == :month or frequency == :quarter or frequency == :week or frequency == :day)
    #raise AggregationException.new if freq == 'month' and (frequency == :month or frequency == :week or frequency == :day)
    #raise AggregationException.new if freq == 'week' and (frequency == :day or frequency == :week)
    #raise AggregationException.new if freq == 'day' and frequency == :day
  end
end
