task :mark_pseudo_history => :environment do
  t = Time.now
  
  DataSource.where("eval LIKE '%bls_histextend_date_format_correct.xls%'").each {|ds| ds.mark_as_pseudo_history}
  DataSource.where("eval LIKE '%inc_hist.xls%'").each {|ds| ds.mark_as_pseudo_history}
  DataSource.where("eval LIKE '%bls_sa_history.xls%'").each {|ds| ds.mark_as_pseudo_history}
  DataSource.where("eval LIKE '%SQ5NHistory.xls%'").each {|ds| ds.mark_as_pseudo_history}
end
