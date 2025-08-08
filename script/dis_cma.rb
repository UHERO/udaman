#!/usr/bin/env ruby

def find_clustermap_list(lists)
  lists.find { |lst| lst[0].include?("Clustermapping API: JSON") }
end

# it'll throw an error when it runs out anyways
for i in 0..10000
    latest = find_clustermap_list(DataSource.load_error_summary)
    series_id = latest[1]
    s = Series.find(series_id)
    ds = s.data_sources
    target = ds.find { |data_source|
        eval_str = data_source.eval
        eval_str.include?("load_api_clusters")
    }
    target.disable!
end
