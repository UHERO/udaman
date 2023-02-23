class String
  def tsnil
    Series.get(self)  ## return nil if named Series does not exist
  end

  def ts
    tsnil || raise("Series #{self} does not exist")  ## blow up if named Series does not exist
  end

  def tsn
    Series.get_or_new(self)
  end

  def dbts
    Series.get(self, 'DBEDT')
  end

  def ts_eval=(eval_statement)
      Series.eval(self, eval_statement, no_enforce_fields: true)
  end

  def ts_append(series)
    Series.store self, series
  end

  def ts_append_eval(eval_statement)
    self.ts_eval= eval_statement
    # t = Time.now
    # new_series = eval eval_statement
    # Series.store self, new_series, new_series.name, eval_statement
    # puts "#{"%.2f" % (Time.now - t)} | #{new_series.data.count} | #{self} | #{eval_statement}"
  end

  ## Just a bit of syntactic sugar to make "SERIES".ts.at("date") a little more compact. Also defaults to causing
  ## the caller to throw an exception if the requested data point is not defined. This should be expected
  ## behavior in most cases.
  def at(date, error: true)
      Series.get(self).at(date, error: error)
    rescue NoMethodError
      raise("Series #{self} does not exist")
  end

  def is_numeric?
    true if Float(self) rescue false
  end

  def unzip(want_file = nil)
    dest_dir = self.change_file_extension('')
    Zip::File.open(self) {|zip_file|
      zip_file.each {|f|
        next if !want_file.blank? && f.name != want_file
        path = File.join(dest_dir, f.name)
        FileUtils.mkdir_p(File.dirname(path)) ## because zip file might contain internal path hierarchy
        FileUtils.rm_rf path
        zip_file.extract(f, path)
      }
    }
  end

  def to_ascii
    require 'stringex/unidecoder'
    Stringex::Unidecoder.decode self
  end
  
  def no_okina
    #uses generic apostrophe... assuming to_ascii_iconv above
    self.gsub("'", '')
  end

  def nil_blank
    self.blank? ? nil : self
  end

  def to_bool
    case self.strip.downcase
      when 'false', 'no', '0', '' then false
      else true
    end
  end

  ## Convert commas to pipes for use by the search engine (Series.search_box). Literal commas are preserved verbatim if
  ## escaped by doubling them.
  def convert_commas
    self.gsub(',,', '#FOO#').gsub(',', '|').gsub('#FOO#', ',')
  end

  def change_file_extension(ext, nopath: false)
    ext = '.' + ext unless ext.empty? || ext =~ /^[.]/
    nameonly = File.basename(self, File.extname(self)) + ext
    nopath ? nameonly : File.join(File.dirname(self), nameonly)
  end

  ## convert frequency string values to numeric ones that can be compared for >, <, etc
  ## returns nil for strings not included
  def freqn
    %w[year semi quarter month week day].index(self.downcase) || %w[A S Q M W D].index(self.upcase) || raise("Unknown frequency #{self}")
  end
end

class NilClass
  def nil_blank
    nil
  end

  def to_bool
    false
  end
end

class Symbol
  def freqn
    self.to_s.freqn
  end
end

class Array
  def cell(row,col)
    return nil if self[row-1].nil?
    self[row-1][col-1]
  end
  
  def last_row
    self.length
  end
  
  def last_column
    self[0].length
  end

  def average
    raise 'Cannot average an empty array' if self.count == 0
    self.sum / self.count.to_f
  end
end

class Hash

  def where_key_belongs_to(an_array)
    select {|key, _| an_array.include? key.to_s }
  end

end

class Float
  def to_sci
    ('%E' % self).to_f
  end
  
  def aremos_trunc
    return self if self == 0
    scale = 10**((Math.log10(self.abs)+1-7).floor)
    (scale * (self / scale).truncate).to_f.round(3)
  end
  
  def aremos_round
    return self if self == 0
    scale = 10**((Math.log10(self.abs)+1).floor)
    ((self / scale).single_precision.round(7) * scale).to_f.round(3)
  end
  
  def aremos_single_precision_round
    return self if self == 0
    scale = 10**((Math.log10(self.abs)+1).floor)
    ((self.single_precision / scale).single_precision.round(7).single_precision * scale).to_f.single_precision.round(3)
  end
  
  def aremos_store_convert
    return self if self == 0
    scale = 10**((Math.log10(self.abs)+1).floor)
    ((self / scale).round(8) * scale).to_f.round(3)
  end
  
  def single_precision
    [self].pack('f').unpack('f')[0]
  end
  
  def sig_digits(num)
    return self if self == 0
    scale = 10**((Math.log10(self.abs)+1).floor)
    ((self / scale).round(num) * scale).to_f
  end
end

### A clever way to convert boolean values to 0 or 1. See usage example in module SeriesHelper
class FalseClass
  def to_01
    0
  end

  def to_bool
    false
  end
end

class TrueClass
  def to_01
    1
  end

  def to_bool
    true
  end
end
