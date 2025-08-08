module Downloaders
  class StringWithDatePatternProcessor
    def initialize(string_format)
      @string_format = string_format.to_s
    end

    def compute(date_string)
      #  what to return if date_string.nil?
      if date_sensitive?
        (date_string.to_s).to_date.strftime(@string_format)
      else
        @string_format
      end
    end

    def date_sensitive?
      @string_format.include?("%")
    end

    def to_s
      @string_format
    end
  end
end
