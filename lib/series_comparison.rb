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
  
  def round_to_1000(num)
    (((num)*1000).round)/1000.to_f
  end
  
  def match_data(data1, data2)
    begin
      # return true if data1.class == String and (data1.strip == "" and data2.nil?) 
      #       return true if data2.class == String and (data1.nil? and data2.strip == "") 
      return false if data1.class != data2.class unless (data1.class == Float and data2.class == Fixnum) or (data2.class == Float and data1.class == Fixnum)
      return true if data1 == 0.0 and data2 == 0.0
      tolerance_check = nil
      tolerance_check = (data1 - data2).abs < 0.05 * data1.abs if data1.class == Float
      rounding_check = nil
      rounding_check = round_to_1000(data1) == round_to_1000(data2) if data1.class == Float
      return (tolerance_check or rounding_check) if data1.class == Float
      return data1 == data2
    rescue FloatDomainError
      return data1 == data2
    end
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
end
