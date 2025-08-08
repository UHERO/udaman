#!/usr/bin/env ruby

def find_timed_out_list(lists)
  lists.find { |lst| lst[0].include?("Timed out connecting") }
end

def retry_timed_out(retries, timeout_sec)
    begin
        Timeout.timeout(timeout_sec) do
            latest = find_timed_out_list(DataSource.load_error_summary)
            series_id = latest[1]
            s = Series.find(series_id)
            ds = s.data_sources
            puts s.id
            ds.each do |data_source|    
                if data_source.eval.include?("Series.load_from_download")
                    data_source.reload_source
                end
            end
        end
    rescue Timeout::Error
        if retries == 0
            return
        end
        puts "Retrying due to timeout"
        retry_timed_out(retries - 1, timeout_sec)
    end
end

for i in 0..100
    retry_timed_out(3, 100)
end
