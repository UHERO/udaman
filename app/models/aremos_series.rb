class AremosSeries < ActiveRecord::Base
  serialize :data, Hash
  serialize :aremos_data, Array
  
    def AremosSeries.all_names
      all_names_array = []
      all_names = AremosSeries.select(:name).all
      all_names.each {|as| all_names_array.push(as.name)}
      all_names_array
    end

    def AremosSeries.get(name)
      AremosSeries.where(:name => name).first
    end

    def AremosSeries.search(search)      
      search_condition = "%" + search + "%"
      where('name LIKE ? OR description LIKE ?', search_condition, search_condition).order :name
    end
    
    def AremosSeries.web_search(search)
      results = self.search(search)
      results.map do |as| 
        series = as.name.ts
        series_id = series.nil? ? nil : series.id
        { :name => as.name, :description => as.description, :series_id => series_id }
      end
      
    end
    
    def AremosSeries.parse_annual_data(data, start_date_string)
      data_hash = {}
      year = start_date_string[0..3].to_i
      data.each do |datapoint|
        return data_hash if datapoint.strip == ""
        data_hash["#{year}-01-01"] = datapoint.to_f
        year += 1
      end
      return data_hash
    end


    def AremosSeries.parse_semi_annual_data(data, start_date_string)
      data_hash = {}
      year = start_date_string[0..3].to_i
      semi = start_date_string[4..5].to_i
      semi_array = ["01", "07"]
      data.each do |datapoint|
        return data_hash if datapoint.strip == ""
        data_hash["#{year}-#{semi_array[semi-1]}-01"] = datapoint.to_f
        semi += 1
        if (semi > 2)
          semi = 1
          year += 1
        end
      end
      return data_hash
    end
    
    def AremosSeries.parse_quarterly_data(data, start_date_string)
      data_hash = {}
      year = start_date_string[0..3].to_i
      quarter = start_date_string[4..5].to_i
      quarter_array = ["01", "04", "07", "10"]
      data.each do |datapoint|
        return data_hash if datapoint.strip == ""
        data_hash["#{year}-#{quarter_array[quarter-1]}-01"] = datapoint.to_f
        quarter += 1
        if (quarter > 4)
          quarter = 1
          year += 1
        end
      end
      return data_hash
    end

    def AremosSeries.parse_monthly_data(data, start_date_string)
      data_hash = {}
      year = start_date_string[0..3].to_i
      month = start_date_string[4..5].to_i
      data.each do |datapoint|
        return data_hash if datapoint.strip == ""
        month_filler = month < 10 ? "0" : ""
        data_hash["#{year}-#{month_filler}#{month}-01"] = datapoint.to_f
        month += 1
        if (month > 12)
          month = 1
          year += 1
        end
      end
      return data_hash
    end

    def AremosSeries.parse_weekly_data(data, start_date_string)
      data_hash = {}
      date = Date.parse start_date_string
      data.each do |datapoint|
        return data_hash if datapoint.strip == ""
        data_hash[date.to_s] = datapoint.to_f
        date += 7
      end
      return data_hash
    end

    def AremosSeries.parse_daily_data(data, start_date_string)
      data_hash = {}
      date = Date.parse start_date_string
      data.each do |datapoint|
        return data_hash if datapoint.strip == ""
        data_hash[date.to_s] = datapoint.to_f
        date += 1
      end
      return data_hash
    end

    def AremosSeries.parse_data(data, start_date_string, frequency)
      return parse_annual_data(data, start_date_string) if frequency == "A"
      return parse_semi_annual_data(data, start_date_string) if frequency == "S"
      return parse_quarterly_data(data, start_date_string) if frequency == "Q"
      return parse_monthly_data(data, start_date_string) if frequency == "M"
      return parse_weekly_data(data, start_date_string) if frequency == "W"
      return parse_daily_data(data, start_date_string) if frequency == "D"
    end

    def AremosSeries.parse_date(aremos_date_string, frequency, a_date_type, daily_switches)
      if frequency == "W"
        listed_date = Date.parse(aremos_date_string)
        date = listed_date+daily_switches.index("1")
        #puts "#{daily_switches} | #{aremos_date_string} | #{Date.parse(aremos_date_string).wday} | #{date}" 
        return date.to_s
      end
      year = aremos_date_string[0..3]
      month = aremos_date_string[4..5]
      if frequency == "Q"
        month_int = month.to_i * 3 - 2 
        month = month_int < 10 ? "0#{month_int}" : "#{month_int}"
      end
      day = aremos_date_string[6..7]
      day = "01" if day == "00"
      return "#{year}-#{month}-#{day}"
    end

    def AremosSeries.read_date_info(line)
      aremos_update = Date.strptime line[32..39].gsub(/ /,""), "%m/%d/%y"
      return { :aremos_update=> aremos_update, :start => line[44..51], :end => line[52..59], :frequency => line[60..60], :daily_switches => line[73..79] }
    end

    def AremosSeries.read_data(line)
      #return line.split(" ")
      return line.scan(/.{15}/)
    end

    def AremosSeries.save_last_series(series_hash)
      
      t = Time.now
      s = get("#{series_hash[:name]}.#{series_hash[:frequency]}")
      
      if s.nil?
        #end_date = parse_date(series_hash[:end], series_hash[:frequency], :end, series_hash[:daily_switches])

        start_date = parse_date(series_hash[:start], series_hash[:frequency], :start, series_hash[:daily_switches]) 
        start_date_string = series_hash[:frequency] == "W" ? start_date : series_hash[:start]
        data = parse_data(series_hash[:data], start_date_string, series_hash[:frequency])
                
        AremosSeries.create(
           :name => "#{series_hash[:name]}.#{series_hash[:frequency]}",
           :frequency => series_hash[:frequency],
           :description => series_hash[:description],
           :start => start_date,
           :data => data,
           :aremos_update_date => series_hash[:aremos_update]
         ) 
         puts "#{"%.2f" % (Time.now - t)} | added to db #{series_hash[:name]}.#{series_hash[:frequency]}"
      elsif s.aremos_update_date != series_hash[:aremos_update]
        
        #the problem with this check is that if there are multiple updates in a day, only one will be read, so entire database needs to be cleared
        #end_date = parse_date(series_hash[:end], series_hash[:frequency], :end, series_hash[:daily_switches])
        
        start_date = parse_date(series_hash[:start], series_hash[:frequency], :start, series_hash[:daily_switches]) 
        start_date_string = series_hash[:frequency] == "W" ? start_date : series_hash[:start]
        data = parse_data(series_hash[:data], start_date_string, series_hash[:frequency])

        s.update_attributes(
          :frequency => series_hash[:frequency],
          :description => series_hash[:description],
          :start => start_date,
          :data => data,
          :aremos_update_date => series_hash[:aremos_update],
          :updated_at => Time.now
        )
        puts "#{"%.2f" % (Time.now - t)} | wrote in db #{series_hash[:name]}.#{series_hash[:frequency]}"
      else
        puts "#{"%.2f" % (Time.now - t)} | skipped #{(series_hash[:name] + "." + series_hash[:frequency]).ljust(20," ")} | A_Update : #{series_hash[:aremos_update]} | Modified : #{ActiveSupport::TimeZone["Hawaii"].at(s.updated_at)}"
      end
      

      
      
      #puts "skipped #{series_hash[:name]}.#{series_hash[:frequency]}" if s.nil? and s.aremos_update_date == series_hash[:aremos_update]
            
      #"#{series_hash[:name]}.#{series_hash[:frequency]}".ts.aremos_match
      #%Q|('#{series_hash[:name]}.#{series_hash[:frequency]}', '#{series_hash[:frequency]}', '#{series_hash[:description]}', '#{start_date}', NULL, '#{YAML.dump(data).gsub(/'/, "\\\\'")}' , NULL, '#{series_hash[:aremos_update]}', '#{Time.now}', '#{Time.now}')|
      
    end

    def AremosSeries.read_series(line)
      return { :name => line[0..15].strip, :description => line[16..-1].strip }
    end

    def AremosSeries.load_tsd(filename)
      file = File.open(filename, "r")
      just_read_series_name = false
      current_series = ""
      data_hash = {}
      series_hash = {}
      
      inserts = []
            
      #AremosSeries.connection.execute "ALTER TABLE aremos_series DISABLE KEYS"
      ActiveRecord::Base.transaction do
        while (line = file.gets)
          if just_read_series_name
            series_hash.merge!(read_date_info(line))
            just_read_series_name = false
          else
            if line.index("@").nil?
              series_hash[:data] ||= []
              series_hash[:data] += read_data(line)
            else
              #inserts.push save_last_series(series_hash) if series_hash != {}
              save_last_series(series_hash) if series_hash != {}
              series_info = read_series(line)
              series_hash = {}
              series_hash[:name] = series_info[:name]
              series_hash[:description] = series_info[:description]
              just_read_series_name = true
            end
          end
        end
      end
      
      #AremosSeries.connection.execute "ALTER TABLE aremos_series ENABLE KEYS"
      #inserts.push save_last_series(series_hash) if series_hash != {}
      save_last_series(series_hash) if series_hash != {}
       
      
      #sql = "INSERT INTO `aremos_series` (`name`, `frequency`, `description`, `start`, `end`, `data`, `aremos_data`, `aremos_update_date`, `created_at`, `updated_at`) VALUES #{inserts.join(", ")}"
      #AremosSeries.connection.execute sql
    end


  end
