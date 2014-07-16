# run REBUILD.rb line by line

task :rebuild => :environment do
    Rake::Task["reload_aremos"].reenable
    Rake::Task["reload_aremos"].invoke

    File.open('lib/tasks/REBUILD_DOWNLOADS.rb', 'r') do |file|
      while line = file.gets
         line.gsub! "/Volumes/UHEROwork", "/Users/uhero/Documents"
        eval(line)
      end
    end

    error_rounds = []
    errors = []
    last_errors = []

    File.open('lib/tasks/REBUILD.rb', 'r') do |file|
      `chmod -R 777 /Users/uhero/Documents/data/*`
      while line = file.gets
        line.gsub! "/Volumes/UHEROwork", "/Users/uhero/Documents"
        line.gsub! "japan/seasadj/sadata.xls", "rawdata/sadata/japan.xls"
        line.gsub! "bls/seasadj/sadata.xls", "rawdata/sadata/bls.xls"
        line.gsub! "misc/hbr/seasadj/sadata.xls", "rawdata/sadata/misc_hbr.xls"
        line.gsub! "tour/seasadj/sadata.xls", "rawdata/sadata/tour.xls"
        line.gsub! "tax/seasadj/sadata.xls", "rawdata/sadata/tax.xls"
        line.gsub! "misc/prud/seasadj/prud_sa.xls", "rawdata/sadata/misc_prud_prud_sa.xls"
        line.gsub! "misc/hbr/seasadj/mbr_sa.xls", "rawdata/sadata/misc_hbr_mbr_sa.xls"
        line.gsub! "bls/seasadj/bls_wagesa.xls", "rawdata/sadata/bls_wages.xls"
        begin
          eval(line)
          print "."
        rescue Exception => exc
          puts line
          puts exc.message
          errors.push [line,exc.message]
        end
      end
    end

   puts "done with first round\n\n\n\n\n\n\n\n"
    puts last_errors.count
    puts errors.count

    until last_errors.count == errors.count
      error_rounds.push(errors)
      last_errors = errors
      errors = []

      puts "\n\n\n----------WORKING ON ROUND #{} OF ERRORS--------------\n\n\n"
                 
      last_errors.each do |error|
         begin
            eval(error[0])
         rescue Exception => exc
            puts error[0]
            errors.push [error[0], exc.message]
         end
      end

    end

    # use ts_eval_force on these stubborn lines
    errors.each {|e| eval(e[0].gsub "ts_eval", "ts_eval_force")}
    
    error_rounds.each_index do |i|
      error = error_rounds[i] 
      CSV.open("public/rebuild_errors_#{i}.csv", "wb") {|file| error.each {|e| file << e} }
    end
    
end

task :test_case => :environment do
   "CPINS@US.M".tsn.load_from_bls("CUUR0000SA0", "M")
   "CPINS@US.Q".ts_eval= %Q|"CPINS@US.M".ts.aggregate(:quarter, :average)|
   "CPI@US.A".ts_eval= %Q|"CPINS@US.Q".ts.aggregate(:year, :average)|
end

task :output_active_downloads => :environment do
  File.open('lib/tasks/REBUILD_DOWNLOADS.rb', 'w') do |file|
    DsdLogEntry.maximum(:time, :group => :data_source_download_id).each do |dsd_id, time|
      if time > (Date.today - 10.day)
        puts "wrote: #{dsd_id}"
        file.puts DataSourceDownload.find(dsd_id).update_statement
      end
    end 
  end
end
