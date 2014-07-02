# run REBUILD.rb line by line
task :rebuild => :environment do
    fout = File.open('lib/tasks/rebuild_errors.txt', 'w')
    File.open('lib/tasks/REBUILD.rb', 'r') do |file|
        index = 0
        errors = 0
        while line = file.gets
            begin
                eval(line)
            rescue Exception => exc
                puts line
                fout.puts line
                puts exc.message
                fout.puts exc.message
                errors += 1
            end
            index += 1
        end
        puts "#{index} rows"
        puts "#{errors} errors"
    end
end
