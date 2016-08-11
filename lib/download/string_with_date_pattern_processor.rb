class StringWithDatePatternProcessor
  def initialize(string_format)
    @string_format = string_format
  end

  def compute(date_string)
    subbed_path = @string_format
  #  return subbed_path if date_string.nil?
    return date_string.to_date.strftime(@string_format) unless subbed_path.index('%').nil?
    subbed_path
  end
  
  def date_sensitive?
    #nil is not date sensitive
    !@string_format.index('%').nil?
  end
end
