module SeriesComparison
  def match_dates_with(data_to_compare)
    data_non_nil = 0
    self.data.each do |date, value|
      return false unless data_to_compare.has_key? date or value.nil?
      data_non_nil += 1 unless value.nil?
    end
    compare_non_nil = 0
    data_to_compare.each do |_, value|
      compare_non_nil += 1 unless value.nil?
    end
    compare_non_nil == data_non_nil
  end
  
  def match_data_date(date, data_to_compare)
    match_data(self.at(date), data_to_compare[date])
  end


  ## this is only used in the following method. Why is it instance method? Make private?
  def round_to_1000(num)
    (((num)*1000).round)/1000.to_f
  end
  
  def match_data(data1, data2)
    begin
      unless (data1.class == Float && data2.class == Fixnum) || (data2.class == Float && data1.class == Fixnum)
        return false if data1.class != data2.class
      end
      return true if data1 == 0.0 && data2 == 0.0
      if data1.class == Float
        tolerance_check = (data1 - data2).abs < 0.05 * data1.abs
        rounding_check = round_to_1000(data1) == round_to_1000(data2)
        return (tolerance_check or rounding_check)
      end
    rescue FloatDomainError
        ;
    end
    data1 == data2
  end
  
  def identical_to?(data_to_compare)
    self.mult ||= 1
    self.data.sort.each do |date_string, value|
      # puts "comparing #{date_string} series: #{value.class} other: #{data_to_compare[date_string].class}"
      value = value/self.mult.to_f unless value.nil? or value.class == String
      return false unless match_data(value, data_to_compare[date_string])
    end
    match_dates_with(data_to_compare)
  end
  
  #test this
  def sufficient_match?(data_to_compare, prognoz = false)
    self.mult ||= 1
    ret_val = true
    self.prognoz_missing = 0
    self.prognoz_diff = 0
    self.data.each do |date, value|
      value = value/self.mult.to_f unless value.nil? or value.class == String
      match_result = match_data(value, data_to_compare[date]) 
      ret_val = false unless match_result or data_to_compare[date].nil?
      self.prognoz_missing += 1 if match_result == false and (value.nil? and !data_to_compare[date].nil?) and prognoz
      self.prognoz_diff += (data_to_compare[date].to_f - value.to_f).abs if data_to_compare[date] != nil and value != nil and prognoz
    end
    self.save if prognoz
    ret_val
  end
  
  def matches_prognoz?
    sufficient_match? prognoz_output_data, true
    #identical_to? prognoz_output_data
  end
end
