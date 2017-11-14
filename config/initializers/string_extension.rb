class String
  def ts
    Series.get self
  end
  
  def tsn
    Series.get_or_new self
  end
  
  def ts=(series)
    Series.store self, series
  end
  
  def ts_eval=(eval_statement)
    #begin
      Series.eval self, eval_statement
    # rescue Exception
    #    puts "ERROR | #{self} | #{eval_statement}"
    # end
  end

  def ts_eval_force=(eval_statement)
     begin
        Series.eval self, eval_statement
     rescue Exception => e # this is a little crude, could rescue just StandardError and SeriesReloadException
      Series.store self, Series.new_transformation(self, {}, Series.frequency_from_code(self[-1])), "Source Series rescued: #{e.message}", eval_statement
      puts "#{self} | #{eval_statement} | Source Series rescued, #{e.message}" 
     end
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

  def is_numeric?
    true if Float self rescue false
  end
  
  def pdf
    PrognozDataFile.where(:filename => /Data_#{self}.xls$/)[0]
  end

  def time
    t = Time.now
    result = eval self
    puts "operation took #{Time.now - t}"
    result
  end
  
  def unzip(want_file = nil)
    dest_dir = self.change_file_extension('')
    Zip::File.open(self) {|zip_file|
      zip_file.each {|f|
        next if !want_file.blank? && f.name != want_file
        path = File.join(dest_dir, f.name)
        FileUtils.mkdir_p(File.dirname(path))
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

  def change_file_extension(ext)
    ext = '.' + ext unless ext.empty? || ext =~ /^[.]/
    File.join(File.dirname(self), File.basename(self, File.extname(self)) + ext)
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
