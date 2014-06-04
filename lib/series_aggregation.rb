module SeriesAggregation
  def aggregate(frequency, operation, override_prune = false)
    new_series = new_transformation("Aggregated from #{self.name}", aggregate_data_by(frequency, operation, override_prune))
    new_series.frequency = frequency
    new_series
  end
  
  # def aggregate_to(frequency, operation, series_to_store_name)
  #   series_to_store_name.ts= aggregate frequency, operation
  # end
  
  def aggregate_data_by(frequency,operation, override_prune = false)
    validate_aggregation(frequency)
    
    grouped_data = group_data_by frequency, override_prune
    aggregated_data = Hash.new
    grouped_data.keys.each do |date_string|
      aggregated_data[date_string] = grouped_data[date_string].send(operation)
    end
    return aggregated_data
  end
  
  def aggregate_by(frequency,operation, override_prune = false)
    aggregate(frequency, operation, override_prune)
    #Series.new(:data=>aggregate_data_by(frequency, operation, override_prune), :frequency=>frequency)
  end
  
  # Only returns complete groups
  def group_data_by(frequency, override_prune = false)
    validate_aggregation(frequency)
    
    aggregated_data = Hash.new
    frequency_method = frequency.to_s+"_s"
    
    self.data.keys.each do |date_string|
      #puts "#{date_string}: #{self.at date_string}"
      date = Date.parse date_string
      aggregated_data[date.send(frequency_method)] ||= AggregatingArray.new unless self.at(date_string).nil?
      aggregated_data[date.send(frequency_method)].push self.at(date_string) unless self.at(date_string).nil?
    end
    #puts frequency
    #puts self.frequency
    #puts override_prune
    # Prune out any incomplete aggregated groups (except days, since it's complicated to match month to day count)
    #can probably take out this override pruning nonsense since this function doesn't work anyway and should be some kind of interpolation
    
    freq = self.frequency.to_s
    
    aggregated_data.delete_if {|key,value| value.count != 6} if frequency == :semi and freq == "month"
    aggregated_data.delete_if {|key,value| value.count != 3} if (frequency == :quarter and freq == "month") and override_prune == false
    aggregated_data.delete_if {|key,value| value.count != 12} if frequency == :year and freq == "month"
    aggregated_data.delete_if {|key,value| value.count != 4} if frequency == :year and freq == "quarter"
    aggregated_data.delete_if {|key,value| value.count != 2} if frequency == :semi and freq == "quarter"    
    aggregated_data.delete_if {|key,value| value.count != 2} if frequency == :year and freq == "semi"
    aggregated_data.delete_if {|key,value| value.count != Date.parse(key).days_in_month} if frequency == :month and freq == "day"
    #puts key+" "+value.count.to_s + " " + Date.parse(key).days_in_month.to_s;
    #month check for days is more complicated because need to check for number of days in each month

    
    
    return aggregated_data
  end
  
  def validate_aggregation(frequency)
    # The following represent invalid aggregation transitions
    # puts self.name
    # puts "self:#{self.frequency}:#{self.frequency.class}"
    # puts "frequency:#{frequency}:#{frequency.class}"

    freq = self.frequency.to_s
    raise AggregationException.new if ["year", "semi", "quarter", "month", "day"].index(freq).nil?
    raise AggregationException.new if freq == "year"
    raise AggregationException.new if freq == "semi"  and (frequency == :month or frequency == :quarter or frequency == :semi or frequency == :week or frequency == :day)
    raise AggregationException.new if freq == "quarter" and (frequency == :month or frequency == :quarter or frequency == :week or frequency == :day)
    raise AggregationException.new if freq == "month" and (frequency == :month or frequency == :week or frequency == :day)
    raise AggregationException.new if freq == "week" and (frequency == :day or frequency == :week)
    raise AggregationException.new if freq == "day" and frequency == :day
    
  end
  
end
