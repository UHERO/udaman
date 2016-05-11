#BEA DATA DOWNLOADS


###*******************************************************************
###NOTES BOX

#gsp_up works and is complete
#SQ5N has extra commas, is splitting numbers unnecessarily, adding extra years to inc_upd_q  (THIS IS NOW FIXED AFTER REPORTED TO BEA)
#inc_upd_a pulls stuff now, no broken excel, broken up into multiple sheets (one per county), rather than multiple tabs
#com_upd split into multiple files too
#will need a checker to see if it is mapped accurately

###*******************************************************************

task :gsp_upd => :environment do
  t = Time.now
	gsp_defs = {
		"YS@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 6, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YS_PR@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 7, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSAG@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 8, :col => "increment:5:1", :frequency => "A" })/1|, 

		
		"YSAGFA@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 9, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSAGFF@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 10, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMI@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 11, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMIOG@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 12, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMIMI@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 13, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMISP@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 14, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSUT@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 15, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSCT@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 16, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMN@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 17, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMNDR@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 18, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMNDRWD@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 19, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMNDRNM@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 20, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMNDRPM@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 21, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMNDRFB@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 22, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMNDRMC@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 23, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMNDRCM@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 24, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMNDREL@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 25, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMNDRMV@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 26, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMNDRTR@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 27, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMNDRFR@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 28, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMNDRMS@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 29, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMNND@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 30, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMNNDFD@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 31, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMNNDXX@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 32, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMNNDAP@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 33, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMNNDPA@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 34, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMNNDPR@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 35, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMNNDPT@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 36, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMNNDCH@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 37, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMNNDPL@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 38, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSWT@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 39, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSRT@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 40, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSTW@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 41, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSTWTA@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 42, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSTWTR@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 43, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSTWTW@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 44, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSTWTT@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 45, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSTWTG@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 46, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSTWPL@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 47, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSTWSP@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 48, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSTWWH@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 49, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSIF@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 50, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSIFPB@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 51, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSIFMP@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 52, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSIFBC@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 53, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSIFDP@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 54, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSFI@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 55, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSFIMC@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 56, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSFISE@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 57, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSFIIN@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 58, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSFIOT@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 59, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSRE@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 60, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSRERE@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 61, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSRERL@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 62, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSPS@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 63, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSPSLS@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 64, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSPSCO@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 65, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSPSOS@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 66, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSMA@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 67, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSAD@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 68, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSADAD@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 69, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSADWM@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 70, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSED@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 71, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSHC@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 72, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSHCAM@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 73, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSHCHO@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 74, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSHCSO@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 75, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSAE@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 76, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSAEPF@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 77, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSAERE@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 78, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSAF@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 79, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSAFAC@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 80, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSAFFD@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 81, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSOS@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 82, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSGV@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 83, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSGVFD@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 84, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YSGVML@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 85, :col => "increment:5:1", :frequency => "A" })/1|, 
		"YS_GVSL@HI.A" => %Q|Series.load_from_download(  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 86, :col => "increment:5:1", :frequency => "A" })/1|
	
	
		#"YS@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 2, :col => "increment:7:1", :frequency => "A" }|, 
		#"YS_PR@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 3, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSAG@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 4, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSAGFA@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 5, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSAGFF@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 6, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMI@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 7, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMIOG@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 8, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMIMI@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 9, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMISP@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 10, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSUT@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 11, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSCT@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 12, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMN@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 13, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMNDR@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 14, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMNDRWD@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 15, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMNDRNM@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 16, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMNDRPM@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 17, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMNDRFB@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 18, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMNDRMC@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 19, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMNDRCM@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 20, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMNDREL@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 21, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMNDRMV@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 22, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMNDRTR@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 23, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMNDRFR@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 24, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMNDRMS@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 25, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMNND@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 26, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMNNDFD@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 27, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMNNDXX@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 28, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMNNDAP@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 29, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMNNDPA@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 30, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMNNDPR@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 31, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMNNDPT@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 32, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMNNDCH@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 33, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMNNDPL@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 34, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSWT@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 35, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSRT@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 36, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSTW@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 37, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSTWTA@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 38, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSTWTR@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 39, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSTWTW@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 40, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSTWTT@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 41, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSTWTG@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 42, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSTWPL@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 43, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSTWSP@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 44, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSTWWH@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 45, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSIF@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 46, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSIFPB@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 47, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSIFMP@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 48, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSIFBC@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 49, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSIFDP@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 50, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSFI@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 51, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSFIMC@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 52, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSFISE@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 53, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSFIIN@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 54, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSFIOT@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 55, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSRE@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 56, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSRERE@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 57, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSRERL@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 58, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSPS@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 59, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSPSLS@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 60, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSPSCO@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 61, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSPSOS@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 62, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSMA@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 63, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSAD@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 64, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSADAD@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 65, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSADWM@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 66, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSED@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 67, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSHC@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 68, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSHCAM@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 69, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSHCHO@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 70, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSHCSO@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 71, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSAE@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 72, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSAEPF@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 73, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSAERE@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 74, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSAF@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 75, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSAFAC@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 76, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSAFFD@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 77, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSOS@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 78, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSGV@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 79, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSGVFD@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 80, :col => "increment:7:1", :frequency => "A" }|, 
		#"YSGVML@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 81, :col => "increment:7:1", :frequency => "A" }|, 
		#"YS_GVSL@HI.A" => %Q|Series.load_from_download  "GSP@bea.gov", { :file_type => "csv", :start_date => "1997-01-01", :row => 82, :col => "increment:7:1", :frequency => "A" }|
	}

	p = Packager.new
	p.add_definitions gsp_defs
	p.write_definitions_to "#{ENV['DATA_PATH']}/bea/update/gsp_upd_NEW.xls"

  CSV.open("public/rake_time.csv", "a") {|csv| csv << ["gsp_upd", "%.2f" % (Time.now - t) , t.to_s, Time.now.to_s] }
end

task :inc_upd_q => :environment do
  t = Time.now
	inc_defs = {
"Y@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 7, :col => "increment:5:1", :frequency => "Q" }|,
"YL@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 9, :col => "increment:5:1", :frequency => "Q" }|,
"YSOCSEC@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 10, :col => "increment:5:1", :frequency => "Q" }|,
"YSOCSECPR@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 11, :col => "increment:5:1", :frequency => "Q" }|,
"YSOCSECEM@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 12, :col => "increment:5:1", :frequency => "Q" }|,
"YRESADJ@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 13, :col => "increment:5:1", :frequency => "Q" }|,
"YNETR@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 14, :col => "increment:5:1", :frequency => "Q" }|,
"YDIV@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 15, :col => "increment:5:1", :frequency => "Q" }|,
"YTRNSF@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 16, :col => "increment:5:1", :frequency => "Q" }|,
"YTRNSFUI@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 17, :col => "increment:5:1", :frequency => "Q" }|,
"YTRNSFOT@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 18, :col => "increment:5:1", :frequency => "Q" }|,
"YWAGE@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 21, :col => "increment:5:1", :frequency => "Q" }|,
"YOTLAB@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 22, :col => "increment:5:1", :frequency => "Q" }|,
"YOTLABPEN@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 23, :col => "increment:5:1", :frequency => "Q" }|,
"YOTLABSS@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 24, :col => "increment:5:1", :frequency => "Q" }|,
"YPROP@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 25, :col => "increment:5:1", :frequency => "Q" }|,
"YPROPFA@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 26, :col => "increment:5:1", :frequency => "Q" }|,
"YPROPNF@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 27, :col => "increment:5:1", :frequency => "Q" }|,
"YLAGFA@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 29, :col => "increment:5:1", :frequency => "Q" }|,
"YL_NF@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 30, :col => "increment:5:1", :frequency => "Q" }|,
"YL_PR@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 31, :col => "increment:5:1", :frequency => "Q" }|,
"YLAGFF@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 32, :col => "increment:5:1", :frequency => "Q" }|,
"YLMI@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 33, :col => "increment:5:1", :frequency => "Q" }|,
"YLUT@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 34, :col => "increment:5:1", :frequency => "Q" }|,
"YLCT@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 35, :col => "increment:5:1", :frequency => "Q" }|,
"YLMN@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 36, :col => "increment:5:1", :frequency => "Q" }|,
"YLMNDR@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 37, :col => "increment:5:1", :frequency => "Q" }|,
"YLMNND@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 38, :col => "increment:5:1", :frequency => "Q" }|,
"YLWT@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 39, :col => "increment:5:1", :frequency => "Q" }|,
"YLRT@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 40, :col => "increment:5:1", :frequency => "Q" }|,
"YLTW@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 41, :col => "increment:5:1", :frequency => "Q" }|,
"YLIF@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 42, :col => "increment:5:1", :frequency => "Q" }|,
"YLFI@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 43, :col => "increment:5:1", :frequency => "Q" }|,
"YLRE@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 44, :col => "increment:5:1", :frequency => "Q" }|,
"YLPS@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 45, :col => "increment:5:1", :frequency => "Q" }|,
"YLMA@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 46, :col => "increment:5:1", :frequency => "Q" }|,
"YLAD@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 47, :col => "increment:5:1", :frequency => "Q" }|,
"YLED@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 48, :col => "increment:5:1", :frequency => "Q" }|,
"YLHC@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 49, :col => "increment:5:1", :frequency => "Q" }|,
"YLAE@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 50, :col => "increment:5:1", :frequency => "Q" }|,
"YLAF@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 51, :col => "increment:5:1", :frequency => "Q" }|,
"YLOS@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 52, :col => "increment:5:1", :frequency => "Q" }|,
"YLGV@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 53, :col => "increment:5:1", :frequency => "Q" }|,
"YLGVFD@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 54, :col => "increment:5:1", :frequency => "Q" }|,
"YLGVML@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 55, :col => "increment:5:1", :frequency => "Q" }|,
"YL_GVSL@HI.Q" => %Q|Series.load_from_download "SQ5N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 56, :col => "increment:5:1", :frequency => "Q" }|

	}

	p = Packager.new
	p.add_definitions inc_defs
	p.write_definitions_to "#{ENV['DATA_PATH']}/bea/update/inc_upd_q_NEW.xls"
	
	CSV.open("public/rake_time.csv", "a") {|csv| csv << ["inc_upd_q", "%.2f" % (Time.now - t) , t.to_s, Time.now.to_s] }
end

task :inc_upd_a => :environment do
  t = Time.now
	inc_hi_a = {
	  "Y@HI.A" => %Q|Series.load_from_download "SA04@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 7, :col => "increment:5:1", :frequency => "A" }|,
    "NRBEA@HI.A" => %Q|Series.load_from_download "SA04@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 10, :col => "increment:5:1", :frequency => "A" }|,
    "YPCBEA@HI.A" => %Q|Series.load_from_download "SA04@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 11, :col => "increment:5:1", :frequency => "A" }|,
    "YL@HI.A" => %Q|Series.load_from_download "SA04@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 13, :col => "increment:5:1", :frequency => "A" }|,
    "YSOCSEC@HI.A" => %Q|Series.load_from_download "SA04@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 14, :col => "increment:5:1", :frequency => "A" }|,
    "YSOCSECPR@HI.A" => %Q|Series.load_from_download "SA04@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 15, :col => "increment:5:1", :frequency => "A" }|,
    "YSOCSECEM@HI.A" => %Q|Series.load_from_download "SA04@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 16, :col => "increment:5:1", :frequency => "A" }|,
    "YRESADJ@HI.A" => %Q|Series.load_from_download "SA04@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 17, :col => "increment:5:1", :frequency => "A" }|,
    "YNETR@HI.A" => %Q|Series.load_from_download "SA04@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 18, :col => "increment:5:1", :frequency => "A" }|,
    "YDIV@HI.A" => %Q|Series.load_from_download "SA04@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 19, :col => "increment:5:1", :frequency => "A" }|,
    "YTRNSF@HI.A" => %Q|Series.load_from_download "SA04@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 20, :col => "increment:5:1", :frequency => "A" }|,
    "YWAGE@HI.A" => %Q|Series.load_from_download "SA04@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 22, :col => "increment:5:1", :frequency => "A" }|,
    "YOTLAB@HI.A" => %Q|Series.load_from_download "SA04@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 23, :col => "increment:5:1", :frequency => "A" }|,
    "YOTLABPEN@HI.A" => %Q|Series.load_from_download "SA04@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 24, :col => "increment:5:1", :frequency => "A" }|,
    "YOTLABSS@HI.A" => %Q|Series.load_from_download "SA04@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 25, :col => "increment:5:1", :frequency => "A" }|,
    "YPROP@HI.A" => %Q|Series.load_from_download "SA04@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 26, :col => "increment:5:1", :frequency => "A" }|,
    "YPROPFA@HI.A" => %Q|Series.load_from_download "SA04@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 27, :col => "increment:5:1", :frequency => "A" }|,
    "YPROPNF@HI.A" => %Q|Series.load_from_download "SA04@bea.gov", { :file_type => "csv", :start_date => "1929-01-01", :row => 28, :col => "increment:5:1", :frequency => "A" }|,
  
# "Y@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 7, :col => "increment:5:1", :frequency => "A" }|,
# "NRBEA@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 8, :col => "increment:5:1", :frequency => "A" }|,
# "YPCBEA@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 9, :col => "increment:5:1", :frequency => "A" }|,
# "YL@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 11, :col => "increment:5:1", :frequency => "A" }|,
# "YSOCSEC@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 12, :col => "increment:5:1", :frequency => "A" }|,
# "YSOCSECPR@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 13, :col => "increment:5:1", :frequency => "A" }|,
# "YSOCSECEM@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 14, :col => "increment:5:1", :frequency => "A" }|,
# "YRESADJ@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 15, :col => "increment:5:1", :frequency => "A" }|,
# "YNETR@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 16, :col => "increment:5:1", :frequency => "A" }|,
# "YDIV@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 17, :col => "increment:5:1", :frequency => "A" }|,
# "YTRNSF@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 18, :col => "increment:5:1", :frequency => "A" }|,
# "YWAGE@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 21, :col => "increment:5:1", :frequency => "A" }|,
# "YOTLAB@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 22, :col => "increment:5:1", :frequency => "A" }|,
# "YOTLABPEN@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 23, :col => "increment:5:1", :frequency => "A" }|,
# "YOTLABSS@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 24, :col => "increment:5:1", :frequency => "A" }|,
# "YPROP@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 25, :col => "increment:5:1", :frequency => "A" }|,
# "YPROPFA@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 26, :col => "increment:5:1", :frequency => "A" }|,
# "YPROPNF@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 27, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFA@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 29, :col => "increment:5:1", :frequency => "A" }|,
"YL_NF@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 30, :col => "increment:5:1", :frequency => "A" }|,
"YL_PR@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 31, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFF@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 32, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFFFO@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 33, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFFFS@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 34, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFFSP@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 35, :col => "increment:5:1", :frequency => "A" }|,
"YLMI@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 36, :col => "increment:5:1", :frequency => "A" }|,
"YLMIOG@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 37, :col => "increment:5:1", :frequency => "A" }|,
"YLMIMI@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 38, :col => "increment:5:1", :frequency => "A" }|,
"YLMISP@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 39, :col => "increment:5:1", :frequency => "A" }|,
"YLUT@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 40, :col => "increment:5:1", :frequency => "A" }|,
"YLCT@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 41, :col => "increment:5:1", :frequency => "A" }|,
"YLCTBL@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 42, :col => "increment:5:1", :frequency => "A" }|,
"YLCTHV@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 43, :col => "increment:5:1", :frequency => "A" }|,
"YLCTSP@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 44, :col => "increment:5:1", :frequency => "A" }|,
"YLMN@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 45, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDR@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 46, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRWD@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 47, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRNM@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 48, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRPM@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 49, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRFB@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 50, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRMC@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 51, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRCM@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 52, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDREL@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 53, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRMV@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 54, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRTR@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 55, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRFR@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 56, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRMS@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 57, :col => "increment:5:1", :frequency => "A" }|,
"YLMNND@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 58, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDFD@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 59, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDBV@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 60, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDXM@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 61, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDXP@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 62, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDAP@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 63, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDLT@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 64, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDPA@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 65, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDPR@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 66, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDPT@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 67, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDCH@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 68, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDPL@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 69, :col => "increment:5:1", :frequency => "A" }|,
"YLWT@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 70, :col => "increment:5:1", :frequency => "A" }|,
"YLRT@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 71, :col => "increment:5:1", :frequency => "A" }|,
"YLRTMV@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 72, :col => "increment:5:1", :frequency => "A" }|,
"YLRTFR@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 73, :col => "increment:5:1", :frequency => "A" }|,
"YLRTEL@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 74, :col => "increment:5:1", :frequency => "A" }|,
"YLRTBL@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 75, :col => "increment:5:1", :frequency => "A" }|,
"YLRTFD@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 76, :col => "increment:5:1", :frequency => "A" }|,
"YLRTHC@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 77, :col => "increment:5:1", :frequency => "A" }|,
"YLRTGA@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 78, :col => "increment:5:1", :frequency => "A" }|,
"YLRTCL@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 79, :col => "increment:5:1", :frequency => "A" }|,
"YLRTSP@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 80, :col => "increment:5:1", :frequency => "A" }|,
"YLRTGM@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 81, :col => "increment:5:1", :frequency => "A" }|,
"YLRTMS@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 82, :col => "increment:5:1", :frequency => "A" }|,
"YLRTOT@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 83, :col => "increment:5:1", :frequency => "A" }|,
"YLTW@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 84, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTA@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 85, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTR@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 86, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTW@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 87, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTT@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 88, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTG@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 89, :col => "increment:5:1", :frequency => "A" }|,
"YLTWPL@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 90, :col => "increment:5:1", :frequency => "A" }|,
"YLTWSC@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 91, :col => "increment:5:1", :frequency => "A" }|,
"YLTWSP@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 92, :col => "increment:5:1", :frequency => "A" }|,
"YLTWCU@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 93, :col => "increment:5:1", :frequency => "A" }|,
"YLTWWH@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 94, :col => "increment:5:1", :frequency => "A" }|,
"YLIF@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 95, :col => "increment:5:1", :frequency => "A" }|,
"YLIFPB@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 96, :col => "increment:5:1", :frequency => "A" }|,
"YLIFMP@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 97, :col => "increment:5:1", :frequency => "A" }|,
"YLIFBC@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 98, :col => "increment:5:1", :frequency => "A" }|,
"YLIFIT@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 99, :col => "increment:5:1", :frequency => "A" }|,
"YLIFTC@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 100, :col => "increment:5:1", :frequency => "A" }|,
"YLIFDP@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 101, :col => "increment:5:1", :frequency => "A" }|,
"YLIFOT@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 102, :col => "increment:5:1", :frequency => "A" }|,
"YLFI@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 103, :col => "increment:5:1", :frequency => "A" }|,
"YLFIMO@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 104, :col => "increment:5:1", :frequency => "A" }|,
"YLFICR@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 105, :col => "increment:5:1", :frequency => "A" }|,
"YLFISE@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 106, :col => "increment:5:1", :frequency => "A" }|,
"YLFIIN@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 107, :col => "increment:5:1", :frequency => "A" }|,
"YLFIOT@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 108, :col => "increment:5:1", :frequency => "A" }|,
"YLRE@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 109, :col => "increment:5:1", :frequency => "A" }|,
"YLRERE@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 110, :col => "increment:5:1", :frequency => "A" }|,
"YLRERL@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 111, :col => "increment:5:1", :frequency => "A" }|,
"YLRELE@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 112, :col => "increment:5:1", :frequency => "A" }|,
"YLPS@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 113, :col => "increment:5:1", :frequency => "A" }|,
"YLMA@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 114, :col => "increment:5:1", :frequency => "A" }|,
"YLAD@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 115, :col => "increment:5:1", :frequency => "A" }|,
"YLADAD@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 116, :col => "increment:5:1", :frequency => "A" }|,
"YLADWM@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 117, :col => "increment:5:1", :frequency => "A" }|,
"YLED@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 118, :col => "increment:5:1", :frequency => "A" }|,
"YLHC@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 119, :col => "increment:5:1", :frequency => "A" }|,
"YLHCAM@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 120, :col => "increment:5:1", :frequency => "A" }|,
"YLHCHO@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 121, :col => "increment:5:1", :frequency => "A" }|,
"YLHCNR@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 122, :col => "increment:5:1", :frequency => "A" }|,
"YLHCSO@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 123, :col => "increment:5:1", :frequency => "A" }|,
"YLAE@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 124, :col => "increment:5:1", :frequency => "A" }|,
"YLAEPF@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 125, :col => "increment:5:1", :frequency => "A" }|,
"YLAEMU@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 126, :col => "increment:5:1", :frequency => "A" }|,
"YLAERE@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 127, :col => "increment:5:1", :frequency => "A" }|,
"YLAF@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 128, :col => "increment:5:1", :frequency => "A" }|,
"YLAFAC@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 129, :col => "increment:5:1", :frequency => "A" }|,
"YLAFFD@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 130, :col => "increment:5:1", :frequency => "A" }|,
"YLOS@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 131, :col => "increment:5:1", :frequency => "A" }|,
"YLOSRP@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 132, :col => "increment:5:1", :frequency => "A" }|,
"YLOSPL@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 133, :col => "increment:5:1", :frequency => "A" }|,
"YLOSMA@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 134, :col => "increment:5:1", :frequency => "A" }|,
"YLOSHH@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 135, :col => "increment:5:1", :frequency => "A" }|,
"YLGV@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 136, :col => "increment:5:1", :frequency => "A" }|,
"YLGVFD@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 137, :col => "increment:5:1", :frequency => "A" }|,
"YLGVML@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 138, :col => "increment:5:1", :frequency => "A" }|,
"YL_GVSL@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 139, :col => "increment:5:1", :frequency => "A" }|,
"YLGVST@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 140, :col => "increment:5:1", :frequency => "A" }|,
"YLGVLC@HI.A" => %Q|Series.load_from_download "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 141, :col => "increment:5:1", :frequency => "A" }|,
		# "YLAGFFOT@HI.A" => %Q|Series.load_from_download  "SA05N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 999, :col => "increment:999:1", :frequency => "A" }|,
		"YL_TRADE@HI.A" => %Q|"YLWT@HI.A".ts + "YLRT@HI.A".ts|,
		"YL_TRADE@HON.A" => %Q|"YLWT@HON.A".ts + "YLRT@HON.A".ts|
		
	}

	inc_haw_a = {
	  
    "Y@HAW.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 7, :col => "increment:5:1", :frequency => "A" }|,
    "NRBEA@HAW.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 10, :col => "increment:5:1", :frequency => "A" }|,
    "YPCBEA@HAW.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 11, :col => "increment:5:1", :frequency => "A" }|,
    "YL@HAW.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 13, :col => "increment:5:1", :frequency => "A" }|,
    "YSOCSEC@HAW.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 14, :col => "increment:5:1", :frequency => "A" }|,
    "YSOCSECPR@HAW.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 15, :col => "increment:5:1", :frequency => "A" }|,
    "YSOCSECEM@HAW.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 16, :col => "increment:5:1", :frequency => "A" }|,
    "YRESADJ@HAW.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 17, :col => "increment:5:1", :frequency => "A" }|,
    "YNETR@HAW.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 18, :col => "increment:5:1", :frequency => "A" }|,
    "YDIV@HAW.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 19, :col => "increment:5:1", :frequency => "A" }|,
    "YTRNSF@HAW.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 20, :col => "increment:5:1", :frequency => "A" }|,
    #"YWAGE@HAW.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 22, :col => "increment:5:1", :frequency => "A" }|,
    #"YOTLAB@HAW.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 23, :col => "increment:5:1", :frequency => "A" }|,
    #"YOTLABPEN@HAW.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 24, :col => "increment:5:1", :frequency => "A" }|,
    #"YOTLABSS@HAW.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 25, :col => "increment:5:1", :frequency => "A" }|,
    "YPROP@HAW.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 26, :col => "increment:5:1", :frequency => "A" }|,
    "YPROPFA@HAW.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 27, :col => "increment:5:1", :frequency => "A" }|,
    "YPROPNF@HAW.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 28, :col => "increment:5:1", :frequency => "A" }|,

# "Y@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 143, :col => "increment:5:1", :frequency => "A" }|,
# "NRBEA@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 144, :col => "increment:5:1", :frequency => "A" }|,
# "YPCBEA@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 145, :col => "increment:5:1", :frequency => "A" }|,
# "YL@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 147, :col => "increment:5:1", :frequency => "A" }|,
# "YSOCSEC@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 148, :col => "increment:5:1", :frequency => "A" }|,
# "YSOCSECPR@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 149, :col => "increment:5:1", :frequency => "A" }|,
# "YSOCSECEM@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 150, :col => "increment:5:1", :frequency => "A" }|,
# "YRESADJ@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 151, :col => "increment:5:1", :frequency => "A" }|,
# "YNETR@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 152, :col => "increment:5:1", :frequency => "A" }|,
# "YDIV@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 153, :col => "increment:5:1", :frequency => "A" }|,
# "YTRNSF@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 154, :col => "increment:5:1", :frequency => "A" }|,
# #"YWAGE@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 157, :col => "increment:5:1", :frequency => "A" }|,
# #"YOTLAB@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 158, :col => "increment:5:1", :frequency => "A" }|,
# #"YOTLABPEN@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 159, :col => "increment:5:1", :frequency => "A" }|,
# #"YOTLABSS@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 160, :col => "increment:5:1", :frequency => "A" }|,
# "YPROP@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 161, :col => "increment:5:1", :frequency => "A" }|,
# "YPROPFA@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 162, :col => "increment:5:1", :frequency => "A" }|,
# "YPROPNF@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 163, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFA@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 165, :col => "increment:5:1", :frequency => "A" }|,
"YL_NF@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 166, :col => "increment:5:1", :frequency => "A" }|,
"YL_PR@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 167, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFF@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 168, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFFFO@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 169, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFFFS@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 170, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFFSP@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 171, :col => "increment:5:1", :frequency => "A" }|,
"YLMI@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 172, :col => "increment:5:1", :frequency => "A" }|,
"YLMIOG@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 173, :col => "increment:5:1", :frequency => "A" }|,
"YLMIMI@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 174, :col => "increment:5:1", :frequency => "A" }|,
"YLMISP@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 175, :col => "increment:5:1", :frequency => "A" }|,
"YLUT@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 176, :col => "increment:5:1", :frequency => "A" }|,
"YLCT@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 177, :col => "increment:5:1", :frequency => "A" }|,
"YLCTBL@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 178, :col => "increment:5:1", :frequency => "A" }|,
"YLCTHV@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 179, :col => "increment:5:1", :frequency => "A" }|,
"YLCTSP@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 180, :col => "increment:5:1", :frequency => "A" }|,
"YLMN@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 181, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDR@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 182, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRWD@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 183, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRNM@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 184, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRPM@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 185, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRFB@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 186, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRMC@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 187, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRCM@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 188, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDREL@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 189, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRMV@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 190, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRTR@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 191, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRFR@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 192, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRMS@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 193, :col => "increment:5:1", :frequency => "A" }|,
"YLMNND@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 194, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDFD@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 195, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDBV@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 196, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDXM@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 197, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDXP@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 198, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDAP@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 199, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDLT@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 200, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDPA@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 201, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDPR@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 202, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDPT@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 203, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDCH@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 204, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDPL@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 205, :col => "increment:5:1", :frequency => "A" }|,
"YLWT@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 206, :col => "increment:5:1", :frequency => "A" }|,
"YLRT@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 207, :col => "increment:5:1", :frequency => "A" }|,
"YLRTMV@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 208, :col => "increment:5:1", :frequency => "A" }|,
"YLRTFR@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 209, :col => "increment:5:1", :frequency => "A" }|,
"YLRTEL@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 210, :col => "increment:5:1", :frequency => "A" }|,
"YLRTBL@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 211, :col => "increment:5:1", :frequency => "A" }|,
"YLRTFD@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 212, :col => "increment:5:1", :frequency => "A" }|,
"YLRTHC@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 213, :col => "increment:5:1", :frequency => "A" }|,
"YLRTGA@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 214, :col => "increment:5:1", :frequency => "A" }|,
"YLRTCL@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 215, :col => "increment:5:1", :frequency => "A" }|,
"YLRTSP@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 216, :col => "increment:5:1", :frequency => "A" }|,
"YLRTGM@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 217, :col => "increment:5:1", :frequency => "A" }|,
"YLRTMS@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 218, :col => "increment:5:1", :frequency => "A" }|,
"YLRTOT@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 219, :col => "increment:5:1", :frequency => "A" }|,
"YLTW@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 220, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTA@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 221, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTR@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 222, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTW@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 223, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTT@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 224, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTG@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 225, :col => "increment:5:1", :frequency => "A" }|,
"YLTWPL@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 226, :col => "increment:5:1", :frequency => "A" }|,
"YLTWSC@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 227, :col => "increment:5:1", :frequency => "A" }|,
"YLTWSP@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 228, :col => "increment:5:1", :frequency => "A" }|,
"YLTWCU@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 229, :col => "increment:5:1", :frequency => "A" }|,
"YLTWWH@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 230, :col => "increment:5:1", :frequency => "A" }|,
"YLIF@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 231, :col => "increment:5:1", :frequency => "A" }|,
"YLIFPB@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 232, :col => "increment:5:1", :frequency => "A" }|,
"YLIFMP@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 233, :col => "increment:5:1", :frequency => "A" }|,
"YLIFBC@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 234, :col => "increment:5:1", :frequency => "A" }|,
"YLIFIT@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 235, :col => "increment:5:1", :frequency => "A" }|,
"YLIFTC@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 236, :col => "increment:5:1", :frequency => "A" }|,
"YLIFDP@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 237, :col => "increment:5:1", :frequency => "A" }|,
"YLIFOT@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 238, :col => "increment:5:1", :frequency => "A" }|,
"YLFI@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 239, :col => "increment:5:1", :frequency => "A" }|,
"YLFIMO@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 240, :col => "increment:5:1", :frequency => "A" }|,
"YLFICR@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 241, :col => "increment:5:1", :frequency => "A" }|,
"YLFISE@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 242, :col => "increment:5:1", :frequency => "A" }|,
"YLFIIN@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 243, :col => "increment:5:1", :frequency => "A" }|,
"YLFIOT@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 244, :col => "increment:5:1", :frequency => "A" }|,
"YLRE@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 245, :col => "increment:5:1", :frequency => "A" }|,
"YLRERE@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 246, :col => "increment:5:1", :frequency => "A" }|,
"YLRERL@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 247, :col => "increment:5:1", :frequency => "A" }|,
"YLRELE@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 248, :col => "increment:5:1", :frequency => "A" }|,
"YLPS@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 249, :col => "increment:5:1", :frequency => "A" }|,
"YLMA@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 250, :col => "increment:5:1", :frequency => "A" }|,
"YLAD@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 251, :col => "increment:5:1", :frequency => "A" }|,
"YLADAD@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 252, :col => "increment:5:1", :frequency => "A" }|,
"YLADWM@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 253, :col => "increment:5:1", :frequency => "A" }|,
"YLED@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 254, :col => "increment:5:1", :frequency => "A" }|,
"YLHC@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 255, :col => "increment:5:1", :frequency => "A" }|,
"YLHCAM@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 256, :col => "increment:5:1", :frequency => "A" }|,
"YLHCHO@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 257, :col => "increment:5:1", :frequency => "A" }|,
"YLHCNR@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 258, :col => "increment:5:1", :frequency => "A" }|,
"YLHCSO@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 259, :col => "increment:5:1", :frequency => "A" }|,
"YLAE@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 260, :col => "increment:5:1", :frequency => "A" }|,
"YLAEPF@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 261, :col => "increment:5:1", :frequency => "A" }|,
"YLAEMU@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 262, :col => "increment:5:1", :frequency => "A" }|,
"YLAERE@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 263, :col => "increment:5:1", :frequency => "A" }|,
"YLAF@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 264, :col => "increment:5:1", :frequency => "A" }|,
"YLAFAC@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 265, :col => "increment:5:1", :frequency => "A" }|,
"YLAFFD@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 266, :col => "increment:5:1", :frequency => "A" }|,
"YLOS@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 267, :col => "increment:5:1", :frequency => "A" }|,
"YLOSRP@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 268, :col => "increment:5:1", :frequency => "A" }|,
"YLOSPL@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 269, :col => "increment:5:1", :frequency => "A" }|,
"YLOSMA@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 270, :col => "increment:5:1", :frequency => "A" }|,
"YLOSHH@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 271, :col => "increment:5:1", :frequency => "A" }|,
"YLGV@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 272, :col => "increment:5:1", :frequency => "A" }|,
"YLGVFD@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 273, :col => "increment:5:1", :frequency => "A" }|,
"YLGVML@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 274, :col => "increment:5:1", :frequency => "A" }|,
"YL_GVSL@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 275, :col => "increment:5:1", :frequency => "A" }|,
"YLGVST@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 276, :col => "increment:5:1", :frequency => "A" }|,
"YLGVLC@HAW.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 277, :col => "increment:5:1", :frequency => "A" }|,
		"YL_TU@HI.A" => %Q|"YLTW@HI.A".ts + "YLUT@HI.A".ts|,
		"YL_TU@HON.A" => %Q|"YLTW@HON.A".ts + "YLUT@HON.A".ts|,
		"YL_TU@HAW.A" => %Q|"YLTW@HAW.A".ts + "YLUT@HAW.A".ts|,
		"YL_TU@MAU.A" => %Q|"YLTW@MAU.A".ts + "YLUT@MAU.A".ts|,
		"YL_TU@KAU.A" => %Q|"YLTW@KAU.A".ts + "YLUT@KAU.A".ts|,
		"YL_TR@HI.A" => %Q|"YLWT@HI.A".ts + "YLRT@HI.A".ts|,
		"YL_TR@HON.A" => %Q|"YLWT@HON.A".ts + "YLRT@HON.A".ts|,
		"YL_TR@HAW.A" => %Q|"YLWT@HAW.A".ts + "YLRT@HAW.A".ts|,
		"YL_TR@MAU.A" => %Q|"YLWT@MAU.A".ts + "YLRT@MAU.A".ts|,
		"YL_TR@KAU.A" => %Q|"YLWT@KAU.A".ts + "YLRT@KAU.A".ts|,
		"YL_OT@HI.A" => %Q|"YLMA@HI.A".ts + "YLAD@HI.A".ts + "YLOS@HI.A".ts|,
		"YL_OT@HON.A" => %Q|"YLMA@HON.A".ts + "YLAD@HON.A".ts + "YLOS@HON.A".ts|,
		"YL_OT@HAW.A" => %Q|"YLMA@HAW.A".ts + "YLAD@HAW.A".ts + "YLOS@HAW.A".ts|,
		"YL_OT@MAU.A" => %Q|"YLMA@MAU.A".ts + "YLAD@MAU.A".ts + "YLOS@MAU.A".ts|,
		"YL_OT@KAU.A" => %Q|"YLMA@KAU.A".ts + "YLAD@KAU.A".ts + "YLOS@KAU.A".ts|,

	
	}
	
	inc_hon_a = {

    "Y@HON.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 34, :col => "increment:5:1", :frequency => "A" }|,
    "NRBEA@HON.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 37, :col => "increment:5:1", :frequency => "A" }|,
    "YPCBEA@HON.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 38, :col => "increment:5:1", :frequency => "A" }|,
    "YL@HON.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 40, :col => "increment:5:1", :frequency => "A" }|,
    "YSOCSEC@HON.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 41, :col => "increment:5:1", :frequency => "A" }|,
    "YSOCSECPR@HON.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 42, :col => "increment:5:1", :frequency => "A" }|,
    "YSOCSECEM@HON.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 43, :col => "increment:5:1", :frequency => "A" }|,
    "YRESADJ@HON.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 44, :col => "increment:5:1", :frequency => "A" }|,
    "YNETR@HON.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 45, :col => "increment:5:1", :frequency => "A" }|,
    "YDIV@HON.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 46, :col => "increment:5:1", :frequency => "A" }|,
    "YTRNSF@HON.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 47, :col => "increment:5:1", :frequency => "A" }|,
    #"YWAGE@HON.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 49, :col => "increment:5:1", :frequency => "A" }|,
    #"YOTLAB@HON.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 50, :col => "increment:5:1", :frequency => "A" }|,
    #"YOTLABPEN@HON.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 51, :col => "increment:5:1", :frequency => "A" }|,
    #"YOTLABSS@HON.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 52, :col => "increment:5:1", :frequency => "A" }|,
    "YPROP@HON.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 53, :col => "increment:5:1", :frequency => "A" }|,
    "YPROPFA@HON.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 54, :col => "increment:5:1", :frequency => "A" }|,
    "YPROPNF@HON.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 55, :col => "increment:5:1", :frequency => "A" }|,


# "Y@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 279, :col => "increment:5:1", :frequency => "A" }|,
# "NRBEA@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 280, :col => "increment:5:1", :frequency => "A" }|,
# "YPCBEA@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 281, :col => "increment:5:1", :frequency => "A" }|,
# "YL@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 283, :col => "increment:5:1", :frequency => "A" }|,
# "YSOCSEC@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 284, :col => "increment:5:1", :frequency => "A" }|,
# "YSOCSECPR@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 285, :col => "increment:5:1", :frequency => "A" }|,
# "YSOCSECEM@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 286, :col => "increment:5:1", :frequency => "A" }|,
# "YRESADJ@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 287, :col => "increment:5:1", :frequency => "A" }|,
# "YNETR@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 288, :col => "increment:5:1", :frequency => "A" }|,
# "YDIV@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 289, :col => "increment:5:1", :frequency => "A" }|,
# "YTRNSF@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 290, :col => "increment:5:1", :frequency => "A" }|,
# #"YWAGE@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 293, :col => "increment:5:1", :frequency => "A" }|,
# #"YOTLAB@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 294, :col => "increment:5:1", :frequency => "A" }|,
# #"YOTLABPEN@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 295, :col => "increment:5:1", :frequency => "A" }|,
# #"YOTLABSS@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 296, :col => "increment:5:1", :frequency => "A" }|,
# "YPROP@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 297, :col => "increment:5:1", :frequency => "A" }|,
# "YPROPFA@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 298, :col => "increment:5:1", :frequency => "A" }|,
# "YPROPNF@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 299, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFA@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 301, :col => "increment:5:1", :frequency => "A" }|,
"YL_NF@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 302, :col => "increment:5:1", :frequency => "A" }|,
"YL_PR@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 303, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFF@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 304, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFFFO@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 305, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFFFS@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 306, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFFSP@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 307, :col => "increment:5:1", :frequency => "A" }|,
"YLMI@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 308, :col => "increment:5:1", :frequency => "A" }|,
"YLMIOG@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 309, :col => "increment:5:1", :frequency => "A" }|,
"YLMIMI@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 310, :col => "increment:5:1", :frequency => "A" }|,
"YLMISP@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 311, :col => "increment:5:1", :frequency => "A" }|,
"YLUT@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 312, :col => "increment:5:1", :frequency => "A" }|,
"YLCT@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 313, :col => "increment:5:1", :frequency => "A" }|,
"YLCTBL@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 314, :col => "increment:5:1", :frequency => "A" }|,
"YLCTHV@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 315, :col => "increment:5:1", :frequency => "A" }|,
"YLCTSP@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 316, :col => "increment:5:1", :frequency => "A" }|,
"YLMN@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 317, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDR@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 318, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRWD@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 319, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRNM@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 320, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRPM@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 321, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRFB@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 322, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRMC@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 323, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRCM@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 324, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDREL@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 325, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRMV@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 326, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRTR@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 327, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRFR@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 328, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRMS@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 329, :col => "increment:5:1", :frequency => "A" }|,
"YLMNND@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 330, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDFD@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 331, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDBV@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 332, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDXM@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 333, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDXP@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 334, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDAP@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 335, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDLT@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 336, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDPA@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 337, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDPR@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 338, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDPT@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 339, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDCH@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 340, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDPL@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 341, :col => "increment:5:1", :frequency => "A" }|,
"YLWT@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 342, :col => "increment:5:1", :frequency => "A" }|,
"YLRT@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 343, :col => "increment:5:1", :frequency => "A" }|,
"YLRTMV@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 344, :col => "increment:5:1", :frequency => "A" }|,
"YLRTFR@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 345, :col => "increment:5:1", :frequency => "A" }|,
"YLRTEL@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 346, :col => "increment:5:1", :frequency => "A" }|,
"YLRTBL@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 347, :col => "increment:5:1", :frequency => "A" }|,
"YLRTFD@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 348, :col => "increment:5:1", :frequency => "A" }|,
"YLRTHC@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 349, :col => "increment:5:1", :frequency => "A" }|,
"YLRTGA@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 350, :col => "increment:5:1", :frequency => "A" }|,
"YLRTCL@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 351, :col => "increment:5:1", :frequency => "A" }|,
"YLRTSP@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 352, :col => "increment:5:1", :frequency => "A" }|,
"YLRTGM@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 353, :col => "increment:5:1", :frequency => "A" }|,
"YLRTMS@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 354, :col => "increment:5:1", :frequency => "A" }|,
"YLRTOT@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 355, :col => "increment:5:1", :frequency => "A" }|,
"YLTW@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 356, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTA@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 357, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTR@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 358, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTW@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 359, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTT@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 360, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTG@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 361, :col => "increment:5:1", :frequency => "A" }|,
"YLTWPL@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 362, :col => "increment:5:1", :frequency => "A" }|,
"YLTWSC@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 363, :col => "increment:5:1", :frequency => "A" }|,
"YLTWSP@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 364, :col => "increment:5:1", :frequency => "A" }|,
"YLTWCU@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 365, :col => "increment:5:1", :frequency => "A" }|,
"YLTWWH@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 366, :col => "increment:5:1", :frequency => "A" }|,
"YLIF@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 367, :col => "increment:5:1", :frequency => "A" }|,
"YLIFPB@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 368, :col => "increment:5:1", :frequency => "A" }|,
"YLIFMP@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 369, :col => "increment:5:1", :frequency => "A" }|,
"YLIFBC@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 370, :col => "increment:5:1", :frequency => "A" }|,
"YLIFIT@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 371, :col => "increment:5:1", :frequency => "A" }|,
"YLIFTC@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 372, :col => "increment:5:1", :frequency => "A" }|,
"YLIFDP@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 373, :col => "increment:5:1", :frequency => "A" }|,
"YLIFOT@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 374, :col => "increment:5:1", :frequency => "A" }|,
"YLFI@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 375, :col => "increment:5:1", :frequency => "A" }|,
"YLFIMO@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 376, :col => "increment:5:1", :frequency => "A" }|,
"YLFICR@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 377, :col => "increment:5:1", :frequency => "A" }|,
"YLFISE@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 378, :col => "increment:5:1", :frequency => "A" }|,
"YLFIIN@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 379, :col => "increment:5:1", :frequency => "A" }|,
"YLFIOT@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 380, :col => "increment:5:1", :frequency => "A" }|,
"YLRE@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 381, :col => "increment:5:1", :frequency => "A" }|,
"YLRERE@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 382, :col => "increment:5:1", :frequency => "A" }|,
"YLRERL@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 383, :col => "increment:5:1", :frequency => "A" }|,
"YLRELE@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 384, :col => "increment:5:1", :frequency => "A" }|,
"YLPS@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 385, :col => "increment:5:1", :frequency => "A" }|,
"YLMA@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 386, :col => "increment:5:1", :frequency => "A" }|,
"YLAD@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 387, :col => "increment:5:1", :frequency => "A" }|,
"YLADAD@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 388, :col => "increment:5:1", :frequency => "A" }|,
"YLADWM@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 389, :col => "increment:5:1", :frequency => "A" }|,
"YLED@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 390, :col => "increment:5:1", :frequency => "A" }|,
"YLHC@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 391, :col => "increment:5:1", :frequency => "A" }|,
"YLHCAM@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 392, :col => "increment:5:1", :frequency => "A" }|,
"YLHCHO@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 393, :col => "increment:5:1", :frequency => "A" }|,
"YLHCNR@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 394, :col => "increment:5:1", :frequency => "A" }|,
"YLHCSO@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 395, :col => "increment:5:1", :frequency => "A" }|,
"YLAE@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 396, :col => "increment:5:1", :frequency => "A" }|,
"YLAEPF@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 397, :col => "increment:5:1", :frequency => "A" }|,
"YLAEMU@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 398, :col => "increment:5:1", :frequency => "A" }|,
"YLAERE@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 399, :col => "increment:5:1", :frequency => "A" }|,
"YLAF@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 400, :col => "increment:5:1", :frequency => "A" }|,
"YLAFAC@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 401, :col => "increment:5:1", :frequency => "A" }|,
"YLAFFD@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 402, :col => "increment:5:1", :frequency => "A" }|,
"YLOS@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 403, :col => "increment:5:1", :frequency => "A" }|,
"YLOSRP@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 404, :col => "increment:5:1", :frequency => "A" }|,
"YLOSPL@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 405, :col => "increment:5:1", :frequency => "A" }|,
"YLOSMA@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 406, :col => "increment:5:1", :frequency => "A" }|,
"YLOSHH@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 407, :col => "increment:5:1", :frequency => "A" }|,
"YLGV@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 408, :col => "increment:5:1", :frequency => "A" }|,
"YLGVFD@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 409, :col => "increment:5:1", :frequency => "A" }|,
"YLGVML@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 410, :col => "increment:5:1", :frequency => "A" }|,
"YL_GVSL@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 411, :col => "increment:5:1", :frequency => "A" }|,
"YLGVST@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 412, :col => "increment:5:1", :frequency => "A" }|,
"YLGVLC@HON.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 413, :col => "increment:5:1", :frequency => "A" }|
	}
	
	inc_kau_a = {
	  
    "Y@KAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 61, :col => "increment:5:1", :frequency => "A" }|,
    "NRBEA@KAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 64, :col => "increment:5:1", :frequency => "A" }|,
    "YPCBEA@KAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 65, :col => "increment:5:1", :frequency => "A" }|,
    "YL@KAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 67, :col => "increment:5:1", :frequency => "A" }|,
    "YSOCSEC@KAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 68, :col => "increment:5:1", :frequency => "A" }|,
    "YSOCSECPR@KAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 69, :col => "increment:5:1", :frequency => "A" }|,
    "YSOCSECEM@KAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 70, :col => "increment:5:1", :frequency => "A" }|,
    "YRESADJ@KAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 71, :col => "increment:5:1", :frequency => "A" }|,
    "YNETR@KAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 72, :col => "increment:5:1", :frequency => "A" }|,
    "YDIV@KAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 73, :col => "increment:5:1", :frequency => "A" }|,
    "YTRNSF@KAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 74, :col => "increment:5:1", :frequency => "A" }|,
    #"YWAGE@KAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 76, :col => "increment:5:1", :frequency => "A" }|,
    #"YOTLAB@KAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 77, :col => "increment:5:1", :frequency => "A" }|,
    #"YOTLABPEN@KAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 78, :col => "increment:5:1", :frequency => "A" }|,
    #"YOTLABSS@KAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 79, :col => "increment:5:1", :frequency => "A" }|,
    "YPROP@KAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 80, :col => "increment:5:1", :frequency => "A" }|,
    "YPROPFA@KAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 81, :col => "increment:5:1", :frequency => "A" }|,
    "YPROPNF@KAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 82, :col => "increment:5:1", :frequency => "A" }|,


# "Y@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 415, :col => "increment:5:1", :frequency => "A" }|,
# "NRBEA@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 416, :col => "increment:5:1", :frequency => "A" }|,
# "YPCBEA@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 417, :col => "increment:5:1", :frequency => "A" }|,
# "YL@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 419, :col => "increment:5:1", :frequency => "A" }|,
# "YSOCSEC@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 420, :col => "increment:5:1", :frequency => "A" }|,
# "YSOCSECPR@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 421, :col => "increment:5:1", :frequency => "A" }|,
# "YSOCSECEM@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 422, :col => "increment:5:1", :frequency => "A" }|,
# "YRESADJ@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 423, :col => "increment:5:1", :frequency => "A" }|,
# "YNETR@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 424, :col => "increment:5:1", :frequency => "A" }|,
# "YDIV@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 425, :col => "increment:5:1", :frequency => "A" }|,
# "YTRNSF@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 426, :col => "increment:5:1", :frequency => "A" }|,
# #"YWAGE@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 429, :col => "increment:5:1", :frequency => "A" }|,
# #"YOTLAB@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 430, :col => "increment:5:1", :frequency => "A" }|,
# #"YOTLABPEN@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 431, :col => "increment:5:1", :frequency => "A" }|,
# #"YOTLABSS@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 432, :col => "increment:5:1", :frequency => "A" }|,
# "YPROP@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 433, :col => "increment:5:1", :frequency => "A" }|,
# "YPROPFA@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 434, :col => "increment:5:1", :frequency => "A" }|,
# "YPROPNF@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 435, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFA@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 437, :col => "increment:5:1", :frequency => "A" }|,
"YL_NF@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 438, :col => "increment:5:1", :frequency => "A" }|,
"YL_PR@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 439, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFF@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 440, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFFFO@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 441, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFFFS@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 442, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFFSP@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 443, :col => "increment:5:1", :frequency => "A" }|,
"YLMI@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 444, :col => "increment:5:1", :frequency => "A" }|,
"YLMIOG@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 445, :col => "increment:5:1", :frequency => "A" }|,
"YLMIMI@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 446, :col => "increment:5:1", :frequency => "A" }|,
"YLMISP@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 447, :col => "increment:5:1", :frequency => "A" }|,
"YLUT@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 448, :col => "increment:5:1", :frequency => "A" }|,
"YLCT@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 449, :col => "increment:5:1", :frequency => "A" }|,
"YLCTBL@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 450, :col => "increment:5:1", :frequency => "A" }|,
"YLCTHV@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 451, :col => "increment:5:1", :frequency => "A" }|,
"YLCTSP@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 452, :col => "increment:5:1", :frequency => "A" }|,
"YLMN@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 453, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDR@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 454, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRWD@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 455, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRNM@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 456, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRPM@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 457, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRFB@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 458, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRMC@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 459, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRCM@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 460, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDREL@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 461, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRMV@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 462, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRTR@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 463, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRFR@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 464, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRMS@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 465, :col => "increment:5:1", :frequency => "A" }|,
"YLMNND@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 466, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDFD@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 467, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDBV@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 468, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDXM@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 469, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDXP@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 470, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDAP@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 471, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDLT@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 472, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDPA@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 473, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDPR@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 474, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDPT@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 475, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDCH@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 476, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDPL@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 477, :col => "increment:5:1", :frequency => "A" }|,
"YLWT@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 478, :col => "increment:5:1", :frequency => "A" }|,
"YLRT@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 479, :col => "increment:5:1", :frequency => "A" }|,
"YLRTMV@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 480, :col => "increment:5:1", :frequency => "A" }|,
"YLRTFR@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 481, :col => "increment:5:1", :frequency => "A" }|,
"YLRTEL@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 482, :col => "increment:5:1", :frequency => "A" }|,
"YLRTBL@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 483, :col => "increment:5:1", :frequency => "A" }|,
"YLRTFD@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 484, :col => "increment:5:1", :frequency => "A" }|,
"YLRTHC@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 485, :col => "increment:5:1", :frequency => "A" }|,
"YLRTGA@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 486, :col => "increment:5:1", :frequency => "A" }|,
"YLRTCL@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 487, :col => "increment:5:1", :frequency => "A" }|,
"YLRTSP@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 488, :col => "increment:5:1", :frequency => "A" }|,
"YLRTGM@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 489, :col => "increment:5:1", :frequency => "A" }|,
"YLRTMS@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 490, :col => "increment:5:1", :frequency => "A" }|,
"YLRTOT@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 491, :col => "increment:5:1", :frequency => "A" }|,
"YLTW@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 492, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTA@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 493, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTR@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 494, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTW@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 495, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTT@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 496, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTG@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 497, :col => "increment:5:1", :frequency => "A" }|,
"YLTWPL@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 498, :col => "increment:5:1", :frequency => "A" }|,
"YLTWSC@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 499, :col => "increment:5:1", :frequency => "A" }|,
"YLTWSP@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 500, :col => "increment:5:1", :frequency => "A" }|,
"YLTWCU@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 501, :col => "increment:5:1", :frequency => "A" }|,
"YLTWWH@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 502, :col => "increment:5:1", :frequency => "A" }|,
"YLIF@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 503, :col => "increment:5:1", :frequency => "A" }|,
"YLIFPB@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 504, :col => "increment:5:1", :frequency => "A" }|,
"YLIFMP@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 505, :col => "increment:5:1", :frequency => "A" }|,
"YLIFBC@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 506, :col => "increment:5:1", :frequency => "A" }|,
"YLIFIT@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 507, :col => "increment:5:1", :frequency => "A" }|,
"YLIFTC@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 508, :col => "increment:5:1", :frequency => "A" }|,
"YLIFDP@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 509, :col => "increment:5:1", :frequency => "A" }|,
"YLIFOT@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 510, :col => "increment:5:1", :frequency => "A" }|,
"YLFI@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 511, :col => "increment:5:1", :frequency => "A" }|,
"YLFIMO@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 512, :col => "increment:5:1", :frequency => "A" }|,
"YLFICR@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 513, :col => "increment:5:1", :frequency => "A" }|,
"YLFISE@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 514, :col => "increment:5:1", :frequency => "A" }|,
"YLFIIN@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 515, :col => "increment:5:1", :frequency => "A" }|,
"YLFIOT@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 516, :col => "increment:5:1", :frequency => "A" }|,
"YLRE@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 517, :col => "increment:5:1", :frequency => "A" }|,
"YLRERE@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 518, :col => "increment:5:1", :frequency => "A" }|,
"YLRERL@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 519, :col => "increment:5:1", :frequency => "A" }|,
"YLRELE@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 520, :col => "increment:5:1", :frequency => "A" }|,
"YLPS@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 521, :col => "increment:5:1", :frequency => "A" }|,
"YLMA@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 522, :col => "increment:5:1", :frequency => "A" }|,
"YLAD@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 523, :col => "increment:5:1", :frequency => "A" }|,
"YLADAD@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 524, :col => "increment:5:1", :frequency => "A" }|,
"YLADWM@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 525, :col => "increment:5:1", :frequency => "A" }|,
"YLED@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 526, :col => "increment:5:1", :frequency => "A" }|,
"YLHC@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 527, :col => "increment:5:1", :frequency => "A" }|,
"YLHCAM@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 528, :col => "increment:5:1", :frequency => "A" }|,
"YLHCHO@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 529, :col => "increment:5:1", :frequency => "A" }|,
"YLHCNR@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 530, :col => "increment:5:1", :frequency => "A" }|,
"YLHCSO@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 531, :col => "increment:5:1", :frequency => "A" }|,
"YLAE@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 532, :col => "increment:5:1", :frequency => "A" }|,
"YLAEPF@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 533, :col => "increment:5:1", :frequency => "A" }|,
"YLAEMU@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 534, :col => "increment:5:1", :frequency => "A" }|,
"YLAERE@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 535, :col => "increment:5:1", :frequency => "A" }|,
"YLAF@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 536, :col => "increment:5:1", :frequency => "A" }|,
"YLAFAC@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 537, :col => "increment:5:1", :frequency => "A" }|,
"YLAFFD@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 538, :col => "increment:5:1", :frequency => "A" }|,
"YLOS@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 539, :col => "increment:5:1", :frequency => "A" }|,
"YLOSRP@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 540, :col => "increment:5:1", :frequency => "A" }|,
"YLOSPL@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 541, :col => "increment:5:1", :frequency => "A" }|,
"YLOSMA@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 542, :col => "increment:5:1", :frequency => "A" }|,
"YLOSHH@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 543, :col => "increment:5:1", :frequency => "A" }|,
"YLGV@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 544, :col => "increment:5:1", :frequency => "A" }|,
"YLGVFD@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 545, :col => "increment:5:1", :frequency => "A" }|,
"YLGVML@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 546, :col => "increment:5:1", :frequency => "A" }|,
"YL_GVSL@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 547, :col => "increment:5:1", :frequency => "A" }|,
"YLGVST@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 548, :col => "increment:5:1", :frequency => "A" }|,
"YLGVLC@KAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 549, :col => "increment:5:1", :frequency => "A" }|

	}
	
	inc_mau_a = {

    "Y@MAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 88, :col => "increment:5:1", :frequency => "A" }|,
    "NRBEA@MAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 91, :col => "increment:5:1", :frequency => "A" }|,
    "YPCBEA@MAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 92, :col => "increment:5:1", :frequency => "A" }|,
    "YL@MAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 94, :col => "increment:5:1", :frequency => "A" }|,
    "YSOCSEC@MAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 95, :col => "increment:5:1", :frequency => "A" }|,
    "YSOCSECPR@MAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 96, :col => "increment:5:1", :frequency => "A" }|,
    "YSOCSECEM@MAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 97, :col => "increment:5:1", :frequency => "A" }|,
    "YRESADJ@MAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 98, :col => "increment:5:1", :frequency => "A" }|,
    "YNETR@MAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 99, :col => "increment:5:1", :frequency => "A" }|,
    "YDIV@MAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 100, :col => "increment:5:1", :frequency => "A" }|,
    "YTRNSF@MAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 101, :col => "increment:5:1", :frequency => "A" }|,
    #"YWAGE@MAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 103, :col => "increment:5:1", :frequency => "A" }|,
    #"YOTLAB@MAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 104, :col => "increment:5:1", :frequency => "A" }|,
    #"YOTLABPEN@MAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 105, :col => "increment:5:1", :frequency => "A" }|,
    #"YOTLABSS@MAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 106, :col => "increment:5:1", :frequency => "A" }|,
    "YPROP@MAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 107, :col => "increment:5:1", :frequency => "A" }|,
    "YPROPFA@MAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 108, :col => "increment:5:1", :frequency => "A" }|,
    "YPROPNF@MAU.A" => %Q|Series.load_from_download "CA04@bea.gov", { :file_type => "csv", :start_date => "1969-01-01", :row => 109, :col => "increment:5:1", :frequency => "A" }|,
    
    
# "Y@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 551, :col => "increment:5:1", :frequency => "A" }|,
# "NRBEA@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 552, :col => "increment:5:1", :frequency => "A" }|,
# "YPCBEA@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 553, :col => "increment:5:1", :frequency => "A" }|,
# "YL@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 555, :col => "increment:5:1", :frequency => "A" }|,
# "YSOCSEC@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 556, :col => "increment:5:1", :frequency => "A" }|,
# "YSOCSECPR@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 557, :col => "increment:5:1", :frequency => "A" }|,
# "YSOCSECEM@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 558, :col => "increment:5:1", :frequency => "A" }|,
# "YRESADJ@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 559, :col => "increment:5:1", :frequency => "A" }|,
# "YNETR@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 560, :col => "increment:5:1", :frequency => "A" }|,
# "YDIV@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 561, :col => "increment:5:1", :frequency => "A" }|,
# "YTRNSF@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 562, :col => "increment:5:1", :frequency => "A" }|,
# #"YWAGE@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 565, :col => "increment:5:1", :frequency => "A" }|,
# #"YOTLAB@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 566, :col => "increment:5:1", :frequency => "A" }|,
# #"YOTLABPEN@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 567, :col => "increment:5:1", :frequency => "A" }|,
# #"YOTLABSS@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 568, :col => "increment:5:1", :frequency => "A" }|,
# "YPROP@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 569, :col => "increment:5:1", :frequency => "A" }|,
# "YPROPFA@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 570, :col => "increment:5:1", :frequency => "A" }|,
# "YPROPNF@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 571, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFA@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 573, :col => "increment:5:1", :frequency => "A" }|,
"YL_NF@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 574, :col => "increment:5:1", :frequency => "A" }|,
"YL_PR@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 575, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFF@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 576, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFFFO@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 577, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFFFS@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 578, :col => "increment:5:1", :frequency => "A" }|,
"YLAGFFSP@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 579, :col => "increment:5:1", :frequency => "A" }|,
"YLMI@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 580, :col => "increment:5:1", :frequency => "A" }|,
"YLMIOG@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 581, :col => "increment:5:1", :frequency => "A" }|,
"YLMIMI@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 582, :col => "increment:5:1", :frequency => "A" }|,
"YLMISP@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 583, :col => "increment:5:1", :frequency => "A" }|,
"YLUT@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 584, :col => "increment:5:1", :frequency => "A" }|,
"YLCT@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 585, :col => "increment:5:1", :frequency => "A" }|,
"YLCTBL@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 586, :col => "increment:5:1", :frequency => "A" }|,
"YLCTHV@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 587, :col => "increment:5:1", :frequency => "A" }|,
"YLCTSP@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 588, :col => "increment:5:1", :frequency => "A" }|,
"YLMN@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 589, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDR@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 590, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRWD@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 591, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRNM@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 592, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRPM@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 593, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRFB@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 594, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRMC@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 595, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRCM@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 596, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDREL@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 597, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRMV@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 598, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRTR@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 599, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRFR@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 600, :col => "increment:5:1", :frequency => "A" }|,
"YLMNDRMS@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 601, :col => "increment:5:1", :frequency => "A" }|,
"YLMNND@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 602, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDFD@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 603, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDBV@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 604, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDXM@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 605, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDXP@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 606, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDAP@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 607, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDLT@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 608, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDPA@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 609, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDPR@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 610, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDPT@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 611, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDCH@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 612, :col => "increment:5:1", :frequency => "A" }|,
"YLMNNDPL@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 613, :col => "increment:5:1", :frequency => "A" }|,
"YLWT@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 614, :col => "increment:5:1", :frequency => "A" }|,
"YLRT@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 615, :col => "increment:5:1", :frequency => "A" }|,
"YLRTMV@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 616, :col => "increment:5:1", :frequency => "A" }|,
"YLRTFR@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 617, :col => "increment:5:1", :frequency => "A" }|,
"YLRTEL@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 618, :col => "increment:5:1", :frequency => "A" }|,
"YLRTBL@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 619, :col => "increment:5:1", :frequency => "A" }|,
"YLRTFD@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 620, :col => "increment:5:1", :frequency => "A" }|,
"YLRTHC@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 621, :col => "increment:5:1", :frequency => "A" }|,
"YLRTGA@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 622, :col => "increment:5:1", :frequency => "A" }|,
"YLRTCL@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 623, :col => "increment:5:1", :frequency => "A" }|,
"YLRTSP@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 624, :col => "increment:5:1", :frequency => "A" }|,
"YLRTGM@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 625, :col => "increment:5:1", :frequency => "A" }|,
"YLRTMS@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 626, :col => "increment:5:1", :frequency => "A" }|,
"YLRTOT@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 627, :col => "increment:5:1", :frequency => "A" }|,
"YLTW@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 628, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTA@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 629, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTR@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 630, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTW@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 631, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTT@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 632, :col => "increment:5:1", :frequency => "A" }|,
"YLTWTG@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 633, :col => "increment:5:1", :frequency => "A" }|,
"YLTWPL@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 634, :col => "increment:5:1", :frequency => "A" }|,
"YLTWSC@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 635, :col => "increment:5:1", :frequency => "A" }|,
"YLTWSP@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 636, :col => "increment:5:1", :frequency => "A" }|,
"YLTWCU@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 637, :col => "increment:5:1", :frequency => "A" }|,
"YLTWWH@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 638, :col => "increment:5:1", :frequency => "A" }|,
"YLIF@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 639, :col => "increment:5:1", :frequency => "A" }|,
"YLIFPB@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 640, :col => "increment:5:1", :frequency => "A" }|,
"YLIFMP@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 641, :col => "increment:5:1", :frequency => "A" }|,
"YLIFBC@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 642, :col => "increment:5:1", :frequency => "A" }|,
"YLIFIT@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 643, :col => "increment:5:1", :frequency => "A" }|,
"YLIFTC@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 644, :col => "increment:5:1", :frequency => "A" }|,
"YLIFDP@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 645, :col => "increment:5:1", :frequency => "A" }|,
"YLIFOT@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 646, :col => "increment:5:1", :frequency => "A" }|,
"YLFI@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 647, :col => "increment:5:1", :frequency => "A" }|,
"YLFIMO@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 648, :col => "increment:5:1", :frequency => "A" }|,
"YLFICR@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 649, :col => "increment:5:1", :frequency => "A" }|,
"YLFISE@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 650, :col => "increment:5:1", :frequency => "A" }|,
"YLFIIN@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 651, :col => "increment:5:1", :frequency => "A" }|,
"YLFIOT@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 652, :col => "increment:5:1", :frequency => "A" }|,
"YLRE@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 653, :col => "increment:5:1", :frequency => "A" }|,
"YLRERE@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 654, :col => "increment:5:1", :frequency => "A" }|,
"YLRERL@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 655, :col => "increment:5:1", :frequency => "A" }|,
"YLRELE@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 656, :col => "increment:5:1", :frequency => "A" }|,
"YLPS@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 657, :col => "increment:5:1", :frequency => "A" }|,
"YLMA@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 658, :col => "increment:5:1", :frequency => "A" }|,
"YLAD@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 659, :col => "increment:5:1", :frequency => "A" }|,
"YLADAD@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 660, :col => "increment:5:1", :frequency => "A" }|,
"YLADWM@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 661, :col => "increment:5:1", :frequency => "A" }|,
"YLED@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 662, :col => "increment:5:1", :frequency => "A" }|,
"YLHC@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 663, :col => "increment:5:1", :frequency => "A" }|,
"YLHCAM@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 664, :col => "increment:5:1", :frequency => "A" }|,
"YLHCHO@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 665, :col => "increment:5:1", :frequency => "A" }|,
"YLHCNR@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 666, :col => "increment:5:1", :frequency => "A" }|,
"YLHCSO@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 667, :col => "increment:5:1", :frequency => "A" }|,
"YLAE@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 668, :col => "increment:5:1", :frequency => "A" }|,
"YLAEPF@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 669, :col => "increment:5:1", :frequency => "A" }|,
"YLAEMU@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 670, :col => "increment:5:1", :frequency => "A" }|,
"YLAERE@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 671, :col => "increment:5:1", :frequency => "A" }|,
"YLAF@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 672, :col => "increment:5:1", :frequency => "A" }|,
"YLAFAC@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 673, :col => "increment:5:1", :frequency => "A" }|,
"YLAFFD@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 674, :col => "increment:5:1", :frequency => "A" }|,
"YLOS@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 675, :col => "increment:5:1", :frequency => "A" }|,
"YLOSRP@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 676, :col => "increment:5:1", :frequency => "A" }|,
"YLOSPL@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 677, :col => "increment:5:1", :frequency => "A" }|,
"YLOSMA@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 678, :col => "increment:5:1", :frequency => "A" }|,
"YLOSHH@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 679, :col => "increment:5:1", :frequency => "A" }|,
"YLGV@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 680, :col => "increment:5:1", :frequency => "A" }|,
"YLGVFD@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 681, :col => "increment:5:1", :frequency => "A" }|,
"YLGVML@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 682, :col => "increment:5:1", :frequency => "A" }|,
"YL_GVSL@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 683, :col => "increment:5:1", :frequency => "A" }|,
"YLGVST@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 684, :col => "increment:5:1", :frequency => "A" }|,
"YLGVLC@MAU.A" => %Q|Series.load_from_download "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 685, :col => "increment:5:1", :frequency => "A" }|
		}
	
	p = Packager.new
	p.add_definitions inc_hi_a
	p.write_definitions_to "#{ENV['DATA_PATH']}/bea/update/inc_HIa_NEW.xls"
	
	p = Packager.new
	p.add_definitions inc_haw_a
	p.write_definitions_to "#{ENV['DATA_PATH']}/bea/update/inc_HAWa_NEW.xls"

	p = Packager.new
	p.add_definitions inc_hon_a
	p.write_definitions_to "#{ENV['DATA_PATH']}/bea/update/inc_HONa_NEW.xls"

	p = Packager.new
	p.add_definitions inc_kau_a
	p.write_definitions_to "#{ENV['DATA_PATH']}/bea/update/inc_KAUa_NEW.xls"

	p = Packager.new
	p.add_definitions inc_mau_a
	p.write_definitions_to "#{ENV['DATA_PATH']}/bea/update/inc_MAUa_NEW.xls"

  CSV.open("public/rake_time.csv", "a") {|csv| csv << ["inc_upd_a", "%.2f" % (Time.now - t) , t.to_s, Time.now.to_s] }
end

task :com_upd => :environment do

  t = Time.now
	com_hi = {
"YC@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 7, :col => "increment:5:1", :frequency => "A" }|,
"YCAVR@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 12, :col => "increment:5:1", :frequency => "A" }|,
"YCAGFA@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 14, :col => "increment:5:1", :frequency => "A" }|,
"YC_NF@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 15, :col => "increment:5:1", :frequency => "A" }|,
"YC_PR@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 16, :col => "increment:5:1", :frequency => "A" }|,
"YCAGFF@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 17, :col => "increment:5:1", :frequency => "A" }|,
"YCAGFFFO@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 18, :col => "increment:5:1", :frequency => "A" }|,
"YCAGFFFS@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 19, :col => "increment:5:1", :frequency => "A" }|,
"YCAGFFSP@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 20, :col => "increment:5:1", :frequency => "A" }|,
"YCMI@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 21, :col => "increment:5:1", :frequency => "A" }|,
"YCMIOG@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 22, :col => "increment:5:1", :frequency => "A" }|,
"YCMIMI@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 23, :col => "increment:5:1", :frequency => "A" }|,
"YCMISP@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 24, :col => "increment:5:1", :frequency => "A" }|,
"YCUT@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 25, :col => "increment:5:1", :frequency => "A" }|,
"YCCT@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 26, :col => "increment:5:1", :frequency => "A" }|,
"YCCTBL@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 27, :col => "increment:5:1", :frequency => "A" }|,
"YCCTHV@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 28, :col => "increment:5:1", :frequency => "A" }|,
"YCCTSP@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 29, :col => "increment:5:1", :frequency => "A" }|,
"YCMN@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 30, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDR@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 31, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRWD@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 32, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRNM@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 33, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRPM@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 34, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRFB@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 35, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRMC@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 36, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRCM@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 37, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDREL@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 38, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRMV@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 39, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRTR@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 40, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRFR@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 41, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRMS@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 42, :col => "increment:5:1", :frequency => "A" }|,
"YCMNND@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 43, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDFD@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 44, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDBV@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 45, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDXM@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 46, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDXP@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 47, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDAP@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 48, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDLT@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 49, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDPA@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 50, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDPR@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 51, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDPT@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 52, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDCH@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 53, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDPL@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 54, :col => "increment:5:1", :frequency => "A" }|,
"YCWT@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 55, :col => "increment:5:1", :frequency => "A" }|,
"YCRT@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 56, :col => "increment:5:1", :frequency => "A" }|,
"YCRTMV@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 57, :col => "increment:5:1", :frequency => "A" }|,
"YCRTFR@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 58, :col => "increment:5:1", :frequency => "A" }|,
"YCRTEL@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 59, :col => "increment:5:1", :frequency => "A" }|,
"YCRTBL@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 60, :col => "increment:5:1", :frequency => "A" }|,
"YCRTFD@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 61, :col => "increment:5:1", :frequency => "A" }|,
"YCRTHC@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 62, :col => "increment:5:1", :frequency => "A" }|,
"YCRTGA@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 63, :col => "increment:5:1", :frequency => "A" }|,
"YCRTCL@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 64, :col => "increment:5:1", :frequency => "A" }|,
"YCRTSP@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 65, :col => "increment:5:1", :frequency => "A" }|,
"YCRTGM@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 66, :col => "increment:5:1", :frequency => "A" }|,
"YCRTMS@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 67, :col => "increment:5:1", :frequency => "A" }|,
"YCRTOT@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 68, :col => "increment:5:1", :frequency => "A" }|,
"YCTW@HI.A"=>%Q|Series.load_from_download  "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 69, :col => "increment:5:1", :frequency => "A" }|,
"YCTWTA@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 70, :col => "increment:5:1", :frequency => "A" }|,
"YCTWTR@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 71, :col => "increment:5:1", :frequency => "A" }|,
"YCTWTW@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 72, :col => "increment:5:1", :frequency => "A" }|,
"YCTWTT@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 73, :col => "increment:5:1", :frequency => "A" }|,
"YCTWTG@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 74, :col => "increment:5:1", :frequency => "A" }|,
"YCTWPL@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 75, :col => "increment:5:1", :frequency => "A" }|,
"YCTWSC@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 76, :col => "increment:5:1", :frequency => "A" }|,
"YCTWSP@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 77, :col => "increment:5:1", :frequency => "A" }|,
"YCTWCU@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 78, :col => "increment:5:1", :frequency => "A" }|,
"YCTWWH@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 79, :col => "increment:5:1", :frequency => "A" }|,
"YCIF@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 80, :col => "increment:5:1", :frequency => "A" }|,
"YCIFPB@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 81, :col => "increment:5:1", :frequency => "A" }|,
"YCIFMP@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 82, :col => "increment:5:1", :frequency => "A" }|,
"YCIFBC@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 83, :col => "increment:5:1", :frequency => "A" }|,
"YCIFIT@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 84, :col => "increment:5:1", :frequency => "A" }|,
"YCIFTC@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 85, :col => "increment:5:1", :frequency => "A" }|,
"YCIFDP@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 86, :col => "increment:5:1", :frequency => "A" }|,
"YCIFOT@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 87, :col => "increment:5:1", :frequency => "A" }|,
"YCFI@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 88, :col => "increment:5:1", :frequency => "A" }|,
"YCFIMO@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 89, :col => "increment:5:1", :frequency => "A" }|,
"YCFICR@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 90, :col => "increment:5:1", :frequency => "A" }|,
"YCFISE@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 91, :col => "increment:5:1", :frequency => "A" }|,
"YCFIIN@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 92, :col => "increment:5:1", :frequency => "A" }|,
"YCFIOT@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 93, :col => "increment:5:1", :frequency => "A" }|,
"YCRE@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 94, :col => "increment:5:1", :frequency => "A" }|,
"YCRERE@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 95, :col => "increment:5:1", :frequency => "A" }|,
"YCRERL@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 96, :col => "increment:5:1", :frequency => "A" }|,
"YCRELE@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 97, :col => "increment:5:1", :frequency => "A" }|,
"YCPS@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 98, :col => "increment:5:1", :frequency => "A" }|,
"YCMA@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 99, :col => "increment:5:1", :frequency => "A" }|,
"YCAD@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 100, :col => "increment:5:1", :frequency => "A" }|,
"YCADAD@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 101, :col => "increment:5:1", :frequency => "A" }|,
"YCADWM@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 102, :col => "increment:5:1", :frequency => "A" }|,
"YCED@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 103, :col => "increment:5:1", :frequency => "A" }|,
"YCHC@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 104, :col => "increment:5:1", :frequency => "A" }|,
"YCHCAM@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 105, :col => "increment:5:1", :frequency => "A" }|,
"YCHCHO@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 106, :col => "increment:5:1", :frequency => "A" }|,
"YCHCNR@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 107, :col => "increment:5:1", :frequency => "A" }|,
"YCHCSO@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 108, :col => "increment:5:1", :frequency => "A" }|,
"YCAE@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 109, :col => "increment:5:1", :frequency => "A" }|,
"YCAEPF@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 110, :col => "increment:5:1", :frequency => "A" }|,
"YCAEMU@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 111, :col => "increment:5:1", :frequency => "A" }|,
"YCAERE@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 112, :col => "increment:5:1", :frequency => "A" }|,
"YCAF@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 113, :col => "increment:5:1", :frequency => "A" }|,
"YCAFAC@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 114, :col => "increment:5:1", :frequency => "A" }|,
"YCAFFD@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 115, :col => "increment:5:1", :frequency => "A" }|,
"YCOS@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 116, :col => "increment:5:1", :frequency => "A" }|,
"YCOSRP@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 117, :col => "increment:5:1", :frequency => "A" }|,
"YCOSPL@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 118, :col => "increment:5:1", :frequency => "A" }|,
"YCOSMA@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 119, :col => "increment:5:1", :frequency => "A" }|,
"YCOSHH@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 120, :col => "increment:5:1", :frequency => "A" }|,
"YCGV@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 121, :col => "increment:5:1", :frequency => "A" }|,
"YCGVFD@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 122, :col => "increment:5:1", :frequency => "A" }|,
"YCGVML@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 123, :col => "increment:5:1", :frequency => "A" }|,
"YC_GVSL@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 124, :col => "increment:5:1", :frequency => "A" }|,
"YCGVST@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 125, :col => "increment:5:1", :frequency => "A" }|,
"YCGVLC@HI.A" => %Q|Series.load_from_download "SA06N@bea.gov", { :file_type => "csv", :start_date => "1990-01-01", :row => 126, :col => "increment:5:1", :frequency => "A" }|,

	}
	
com_haw = {
"YC@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 128, :col => "increment:5:1", :frequency => "A" }|, 
"YWAGE@HAW.A" => [%Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 129, :col => "increment:5:1", :frequency => "A" }|, 
%Q|Series.load_from_download  "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 157, :col => "increment:5:1", :frequency => "A" }|], 
"YOTLAB@HAW.A" => [%Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 130, :col => "increment:5:1", :frequency => "A" }|, 
%Q|Series.load_from_download  "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 158, :col => "increment:5:1", :frequency => "A" }|], 
"YOTLABPEN@HAW.A" => [%Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 131, :col => "increment:5:1", :frequency => "A" }|, 
%Q|Series.load_from_download  "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 159, :col => "increment:5:1", :frequency => "A" }|], 
"YOTLABSS@HAW.A" => [%Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 132, :col => "increment:5:1", :frequency => "A" }|, 
%Q|Series.load_from_download  "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 160, :col => "increment:5:1", :frequency => "A" }|], 
"YCAVR@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 133, :col => "increment:5:1", :frequency => "A" }|, 
"YCAGFA@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 135, :col => "increment:5:1", :frequency => "A" }|, 
"YC_NF@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 136, :col => "increment:5:1", :frequency => "A" }|, 
"YC_PR@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 137, :col => "increment:5:1", :frequency => "A" }|, 
"YCAGFF@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 138, :col => "increment:5:1", :frequency => "A" }|, 
"YCAGFFFO@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 139, :col => "increment:5:1", :frequency => "A" }|, 
"YCAGFFFS@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 140, :col => "increment:5:1", :frequency => "A" }|, 
"YCAGFFSP@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 141, :col => "increment:5:1", :frequency => "A" }|, 
"YCMI@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 142, :col => "increment:5:1", :frequency => "A" }|, 
"YCMIOG@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 143, :col => "increment:5:1", :frequency => "A" }|, 
"YCMIMI@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 144, :col => "increment:5:1", :frequency => "A" }|, 
"YCMISP@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 145, :col => "increment:5:1", :frequency => "A" }|, 
"YCUT@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 146, :col => "increment:5:1", :frequency => "A" }|, 
"YCCT@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 147, :col => "increment:5:1", :frequency => "A" }|, 
"YCCTBL@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 148, :col => "increment:5:1", :frequency => "A" }|, 
"YCCTHV@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 149, :col => "increment:5:1", :frequency => "A" }|, 
"YCCTSP@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 150, :col => "increment:5:1", :frequency => "A" }|, 
"YCMN@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 151, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNDR@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 152, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNDRWD@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 153, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNDRNM@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 154, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNDRPM@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 155, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNDRFB@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 156, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNDRMC@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 157, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNDRCM@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 158, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNDREL@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 159, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNDRMV@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 160, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNDRTR@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 161, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNDRFR@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 162, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNDRMS@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 163, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNND@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 164, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNNDFD@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 165, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNNDBV@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 166, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNNDXM@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 167, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNNDXP@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 168, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNNDAP@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 169, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNNDLT@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 170, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNNDPA@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 171, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNNDPR@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 172, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNNDPT@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 173, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNNDCH@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 174, :col => "increment:5:1", :frequency => "A" }|, 
"YCMNNDPL@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 175, :col => "increment:5:1", :frequency => "A" }|, 
"YCWT@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 176, :col => "increment:5:1", :frequency => "A" }|, 
"YCRT@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 177, :col => "increment:5:1", :frequency => "A" }|, 
"YCRTMV@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 178, :col => "increment:5:1", :frequency => "A" }|, 
"YCRTFR@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 179, :col => "increment:5:1", :frequency => "A" }|, 
"YCRTEL@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 180, :col => "increment:5:1", :frequency => "A" }|, 
"YCRTBL@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 181, :col => "increment:5:1", :frequency => "A" }|, 
"YCRTFD@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 182, :col => "increment:5:1", :frequency => "A" }|, 
"YCRTHC@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 183, :col => "increment:5:1", :frequency => "A" }|, 
"YCRTGA@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 184, :col => "increment:5:1", :frequency => "A" }|, 
"YCRTCL@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 185, :col => "increment:5:1", :frequency => "A" }|, 
"YCRTSP@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 186, :col => "increment:5:1", :frequency => "A" }|, 
"YCRTGM@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 187, :col => "increment:5:1", :frequency => "A" }|, 
"YCRTMS@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 188, :col => "increment:5:1", :frequency => "A" }|, 
"YCRTOT@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 189, :col => "increment:5:1", :frequency => "A" }|, 
"YCTW@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 190, :col => "increment:5:1", :frequency => "A" }|, 
"YCTWTA@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 191, :col => "increment:5:1", :frequency => "A" }|, 
"YCTWTR@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 192, :col => "increment:5:1", :frequency => "A" }|, 
"YCTWTW@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 193, :col => "increment:5:1", :frequency => "A" }|, 
"YCTWTT@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 194, :col => "increment:5:1", :frequency => "A" }|, 
"YCTWTG@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 195, :col => "increment:5:1", :frequency => "A" }|, 
"YCTWPL@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 196, :col => "increment:5:1", :frequency => "A" }|, 
"YCTWSC@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 197, :col => "increment:5:1", :frequency => "A" }|, 
"YCTWSP@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 198, :col => "increment:5:1", :frequency => "A" }|, 
"YCTWCU@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 199, :col => "increment:5:1", :frequency => "A" }|, 
"YCTWWH@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 200, :col => "increment:5:1", :frequency => "A" }|, 
"YCIF@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 201, :col => "increment:5:1", :frequency => "A" }|, 
"YCIFPB@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 202, :col => "increment:5:1", :frequency => "A" }|, 
"YCIFMP@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 203, :col => "increment:5:1", :frequency => "A" }|, 
"YCIFBC@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 204, :col => "increment:5:1", :frequency => "A" }|, 
"YCIFIT@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 205, :col => "increment:5:1", :frequency => "A" }|, 
"YCIFTC@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 206, :col => "increment:5:1", :frequency => "A" }|, 
"YCIFDP@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 207, :col => "increment:5:1", :frequency => "A" }|, 
"YCIFOT@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 208, :col => "increment:5:1", :frequency => "A" }|, 
"YCFI@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 209, :col => "increment:5:1", :frequency => "A" }|, 
"YCFIMO@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 210, :col => "increment:5:1", :frequency => "A" }|, 
"YCFICR@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 211, :col => "increment:5:1", :frequency => "A" }|, 
"YCFISE@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 212, :col => "increment:5:1", :frequency => "A" }|, 
"YCFIIN@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 213, :col => "increment:5:1", :frequency => "A" }|, 
"YCFIOT@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 214, :col => "increment:5:1", :frequency => "A" }|, 
"YCRE@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 215, :col => "increment:5:1", :frequency => "A" }|, 
"YCRERE@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 216, :col => "increment:5:1", :frequency => "A" }|, 
"YCRERL@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 217, :col => "increment:5:1", :frequency => "A" }|, 
"YCRELE@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 218, :col => "increment:5:1", :frequency => "A" }|, 
"YCPS@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 219, :col => "increment:5:1", :frequency => "A" }|, 
"YCMA@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 220, :col => "increment:5:1", :frequency => "A" }|, 
"YCAD@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 221, :col => "increment:5:1", :frequency => "A" }|, 
"YCADAD@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 222, :col => "increment:5:1", :frequency => "A" }|, 
"YCADWM@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 223, :col => "increment:5:1", :frequency => "A" }|, 
"YCED@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 224, :col => "increment:5:1", :frequency => "A" }|, 
"YCHC@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 225, :col => "increment:5:1", :frequency => "A" }|, 
"YCHCAM@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 226, :col => "increment:5:1", :frequency => "A" }|, 
"YCHCHO@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 227, :col => "increment:5:1", :frequency => "A" }|, 
"YCHCNR@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 228, :col => "increment:5:1", :frequency => "A" }|, 
"YCHCSO@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 229, :col => "increment:5:1", :frequency => "A" }|, 
"YCAE@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 230, :col => "increment:5:1", :frequency => "A" }|, 
"YCAEPF@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 231, :col => "increment:5:1", :frequency => "A" }|, 
"YCAEMU@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 232, :col => "increment:5:1", :frequency => "A" }|, 
"YCAERE@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 233, :col => "increment:5:1", :frequency => "A" }|, 
"YCAF@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 234, :col => "increment:5:1", :frequency => "A" }|, 
"YCAFAC@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 235, :col => "increment:5:1", :frequency => "A" }|, 
"YCAFFD@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 236, :col => "increment:5:1", :frequency => "A" }|, 
"YCOS@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 237, :col => "increment:5:1", :frequency => "A" }|, 
"YCOSRP@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 238, :col => "increment:5:1", :frequency => "A" }|, 
"YCOSPL@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 239, :col => "increment:5:1", :frequency => "A" }|, 
"YCOSMA@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 240, :col => "increment:5:1", :frequency => "A" }|, 
"YCOSHH@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 241, :col => "increment:5:1", :frequency => "A" }|, 
"YCGV@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 242, :col => "increment:5:1", :frequency => "A" }|, 
"YCGVFD@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 243, :col => "increment:5:1", :frequency => "A" }|, 
"YCGVML@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 244, :col => "increment:5:1", :frequency => "A" }|, 
"YC_GVSL@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 245, :col => "increment:5:1", :frequency => "A" }|, 
"YCGVST@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 246, :col => "increment:5:1", :frequency => "A" }|, 
"YCGVLC@HAW.A" => %Q|Series.load_from_download  "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 247, :col => "increment:5:1", :frequency => "A" }|
}
	
	
	com_hon = {
"YC@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 249, :col => "increment:5:1", :frequency => "A" }|,
"YWAGE@HON.A" => [%Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 250, :col => "increment:5:1", :frequency => "A" }|,
%Q|Series.load_from_download  "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 293, :col => "increment:5:1", :frequency => "A" }|],  
"YOTLAB@HON.A" => [%Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 251, :col => "increment:5:1", :frequency => "A" }|,
%Q|Series.load_from_download  "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 294, :col => "increment:5:1", :frequency => "A" }|],  
"YOTLABPEN@HON.A" => [%Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 252, :col => "increment:5:1", :frequency => "A" }|,
%Q|Series.load_from_download  "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 295, :col => "increment:5:1", :frequency => "A" }|],  
"YOTLABSS@HON.A" => [%Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 253, :col => "increment:5:1", :frequency => "A" }|,
%Q|Series.load_from_download  "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 296, :col => "increment:5:1", :frequency => "A" }|],  
"YCAVR@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 254, :col => "increment:5:1", :frequency => "A" }|,
"YCAGFA@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 256, :col => "increment:5:1", :frequency => "A" }|,
"YC_NF@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 257, :col => "increment:5:1", :frequency => "A" }|,
"YC_PR@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 258, :col => "increment:5:1", :frequency => "A" }|,
"YCAGFF@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 259, :col => "increment:5:1", :frequency => "A" }|,
"YCAGFFFO@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 260, :col => "increment:5:1", :frequency => "A" }|,
"YCAGFFFS@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 261, :col => "increment:5:1", :frequency => "A" }|,
"YCAGFFSP@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 262, :col => "increment:5:1", :frequency => "A" }|,
"YCMI@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 263, :col => "increment:5:1", :frequency => "A" }|,
"YCMIOG@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 264, :col => "increment:5:1", :frequency => "A" }|,
"YCMIMI@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 265, :col => "increment:5:1", :frequency => "A" }|,
"YCMISP@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 266, :col => "increment:5:1", :frequency => "A" }|,
"YCUT@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 267, :col => "increment:5:1", :frequency => "A" }|,
"YCCT@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 268, :col => "increment:5:1", :frequency => "A" }|,
"YCCTBL@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 269, :col => "increment:5:1", :frequency => "A" }|,
"YCCTHV@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 270, :col => "increment:5:1", :frequency => "A" }|,
"YCCTSP@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 271, :col => "increment:5:1", :frequency => "A" }|,
"YCMN@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 272, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDR@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 273, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRWD@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 274, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRNM@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 275, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRPM@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 276, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRFB@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 277, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRMC@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 278, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRCM@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 279, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDREL@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 280, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRMV@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 281, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRTR@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 282, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRFR@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 283, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRMS@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 284, :col => "increment:5:1", :frequency => "A" }|,
"YCMNND@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 285, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDFD@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 286, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDBV@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 287, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDXM@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 288, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDXP@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 289, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDAP@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 290, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDLT@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 291, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDPA@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 292, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDPR@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 293, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDPT@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 294, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDCH@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 295, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDPL@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 296, :col => "increment:5:1", :frequency => "A" }|,
"YCWT@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 297, :col => "increment:5:1", :frequency => "A" }|,
"YCRT@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 298, :col => "increment:5:1", :frequency => "A" }|,
"YCRTMV@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 299, :col => "increment:5:1", :frequency => "A" }|,
"YCRTFR@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 300, :col => "increment:5:1", :frequency => "A" }|,
"YCRTEL@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 301, :col => "increment:5:1", :frequency => "A" }|,
"YCRTBL@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 302, :col => "increment:5:1", :frequency => "A" }|,
"YCRTFD@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 303, :col => "increment:5:1", :frequency => "A" }|,
"YCRTHC@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 304, :col => "increment:5:1", :frequency => "A" }|,
"YCRTGA@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 305, :col => "increment:5:1", :frequency => "A" }|,
"YCRTCL@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 306, :col => "increment:5:1", :frequency => "A" }|,
"YCRTSP@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 307, :col => "increment:5:1", :frequency => "A" }|,
"YCRTGM@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 308, :col => "increment:5:1", :frequency => "A" }|,
"YCRTMS@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 309, :col => "increment:5:1", :frequency => "A" }|,
"YCRTOT@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 310, :col => "increment:5:1", :frequency => "A" }|,
"YCTW@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 311, :col => "increment:5:1", :frequency => "A" }|,
"YCTWTA@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 312, :col => "increment:5:1", :frequency => "A" }|,
"YCTWTR@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 313, :col => "increment:5:1", :frequency => "A" }|,
"YCTWTW@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 314, :col => "increment:5:1", :frequency => "A" }|,
"YCTWTT@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 315, :col => "increment:5:1", :frequency => "A" }|,
"YCTWTG@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 316, :col => "increment:5:1", :frequency => "A" }|,
"YCTWPL@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 317, :col => "increment:5:1", :frequency => "A" }|,
"YCTWSC@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 318, :col => "increment:5:1", :frequency => "A" }|,
"YCTWSP@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 319, :col => "increment:5:1", :frequency => "A" }|,
"YCTWCU@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 320, :col => "increment:5:1", :frequency => "A" }|,
"YCTWWH@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 321, :col => "increment:5:1", :frequency => "A" }|,
"YCIF@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 322, :col => "increment:5:1", :frequency => "A" }|,
"YCIFPB@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 323, :col => "increment:5:1", :frequency => "A" }|,
"YCIFMP@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 324, :col => "increment:5:1", :frequency => "A" }|,
"YCIFBC@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 325, :col => "increment:5:1", :frequency => "A" }|,
"YCIFIT@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 326, :col => "increment:5:1", :frequency => "A" }|,
"YCIFTC@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 327, :col => "increment:5:1", :frequency => "A" }|,
"YCIFDP@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 328, :col => "increment:5:1", :frequency => "A" }|,
"YCIFOT@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 329, :col => "increment:5:1", :frequency => "A" }|,
"YCFI@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 330, :col => "increment:5:1", :frequency => "A" }|,
"YCFIMO@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 331, :col => "increment:5:1", :frequency => "A" }|,
"YCFICR@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 332, :col => "increment:5:1", :frequency => "A" }|,
"YCFISE@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 333, :col => "increment:5:1", :frequency => "A" }|,
"YCFIIN@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 334, :col => "increment:5:1", :frequency => "A" }|,
"YCFIOT@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 335, :col => "increment:5:1", :frequency => "A" }|,
"YCRE@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 336, :col => "increment:5:1", :frequency => "A" }|,
"YCRERE@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 337, :col => "increment:5:1", :frequency => "A" }|,
"YCRERL@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 338, :col => "increment:5:1", :frequency => "A" }|,
"YCRELE@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 339, :col => "increment:5:1", :frequency => "A" }|,
"YCPS@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 340, :col => "increment:5:1", :frequency => "A" }|,
"YCMA@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 341, :col => "increment:5:1", :frequency => "A" }|,
"YCAD@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 342, :col => "increment:5:1", :frequency => "A" }|,
"YCADAD@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 343, :col => "increment:5:1", :frequency => "A" }|,
"YCADWM@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 344, :col => "increment:5:1", :frequency => "A" }|,
"YCED@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 345, :col => "increment:5:1", :frequency => "A" }|,
"YCHC@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 346, :col => "increment:5:1", :frequency => "A" }|,
"YCHCAM@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 347, :col => "increment:5:1", :frequency => "A" }|,
"YCHCHO@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 348, :col => "increment:5:1", :frequency => "A" }|,
"YCHCNR@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 349, :col => "increment:5:1", :frequency => "A" }|,
"YCHCSO@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 350, :col => "increment:5:1", :frequency => "A" }|,
"YCAE@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 351, :col => "increment:5:1", :frequency => "A" }|,
"YCAEPF@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 352, :col => "increment:5:1", :frequency => "A" }|,
"YCAEMU@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 353, :col => "increment:5:1", :frequency => "A" }|,
"YCAERE@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 354, :col => "increment:5:1", :frequency => "A" }|,
"YCAF@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 355, :col => "increment:5:1", :frequency => "A" }|,
"YCAFAC@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 356, :col => "increment:5:1", :frequency => "A" }|,
"YCAFFD@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 357, :col => "increment:5:1", :frequency => "A" }|,
"YCOS@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 358, :col => "increment:5:1", :frequency => "A" }|,
"YCOSRP@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 359, :col => "increment:5:1", :frequency => "A" }|,
"YCOSPL@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 360, :col => "increment:5:1", :frequency => "A" }|,
"YCOSMA@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 361, :col => "increment:5:1", :frequency => "A" }|,
"YCOSHH@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 362, :col => "increment:5:1", :frequency => "A" }|,
"YCGV@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 363, :col => "increment:5:1", :frequency => "A" }|,
"YCGVFD@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 364, :col => "increment:5:1", :frequency => "A" }|,
"YCGVML@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 365, :col => "increment:5:1", :frequency => "A" }|,
"YC_GVSL@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 366, :col => "increment:5:1", :frequency => "A" }|,
"YCGVST@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 367, :col => "increment:5:1", :frequency => "A" }|,
"YCGVLC@HON.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 368, :col => "increment:5:1", :frequency => "A" }|
		}
	
	com_kau = {
"YC@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 370, :col => "increment:5:1", :frequency => "A" }|,
"YWAGE@KAU.A" => [%Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 371, :col => "increment:5:1", :frequency => "A" }|,
  %Q|Series.load_from_download  "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 429, :col => "increment:5:1", :frequency => "A" }|],  
"YOTLAB@KAU.A" => [%Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 372, :col => "increment:5:1", :frequency => "A" }|,
%Q|Series.load_from_download  "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 430, :col => "increment:5:1", :frequency => "A" }|],  
"YOTLABPEN@KAU.A" => [%Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 373, :col => "increment:5:1", :frequency => "A" }|,
%Q|Series.load_from_download  "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 431, :col => "increment:5:1", :frequency => "A" }|],  
"YOTLABSS@KAU.A" => [%Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 374, :col => "increment:5:1", :frequency => "A" }|,
%Q|Series.load_from_download  "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 432, :col => "increment:5:1", :frequency => "A" }|],  
"YCAVR@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 375, :col => "increment:5:1", :frequency => "A" }|,
"YCAGFA@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 377, :col => "increment:5:1", :frequency => "A" }|,
"YC_NF@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 378, :col => "increment:5:1", :frequency => "A" }|,
"YC_PR@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 379, :col => "increment:5:1", :frequency => "A" }|,
"YCAGFF@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 380, :col => "increment:5:1", :frequency => "A" }|,
"YCAGFFFO@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 381, :col => "increment:5:1", :frequency => "A" }|,
"YCAGFFFS@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 382, :col => "increment:5:1", :frequency => "A" }|,
"YCAGFFSP@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 383, :col => "increment:5:1", :frequency => "A" }|,
"YCMI@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 384, :col => "increment:5:1", :frequency => "A" }|,
"YCMIOG@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 385, :col => "increment:5:1", :frequency => "A" }|,
"YCMIMI@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 386, :col => "increment:5:1", :frequency => "A" }|,
"YCMISP@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 387, :col => "increment:5:1", :frequency => "A" }|,
"YCUT@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 388, :col => "increment:5:1", :frequency => "A" }|,
"YCCT@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 389, :col => "increment:5:1", :frequency => "A" }|,
"YCCTBL@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 390, :col => "increment:5:1", :frequency => "A" }|,
"YCCTHV@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 391, :col => "increment:5:1", :frequency => "A" }|,
"YCCTSP@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 392, :col => "increment:5:1", :frequency => "A" }|,
"YCMN@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 393, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDR@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 394, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRWD@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 395, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRNM@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 396, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRPM@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 397, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRFB@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 398, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRMC@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 399, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRCM@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 400, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDREL@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 401, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRMV@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 402, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRTR@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 403, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRFR@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 404, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRMS@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 405, :col => "increment:5:1", :frequency => "A" }|,
"YCMNND@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 406, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDFD@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 407, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDBV@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 408, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDXM@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 409, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDXP@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 410, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDAP@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 411, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDLT@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 412, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDPA@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 413, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDPR@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 414, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDPT@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 415, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDCH@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 416, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDPL@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 417, :col => "increment:5:1", :frequency => "A" }|,
"YCWT@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 418, :col => "increment:5:1", :frequency => "A" }|,
"YCRT@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 419, :col => "increment:5:1", :frequency => "A" }|,
"YCRTMV@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 420, :col => "increment:5:1", :frequency => "A" }|,
"YCRTFR@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 421, :col => "increment:5:1", :frequency => "A" }|,
"YCRTEL@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 422, :col => "increment:5:1", :frequency => "A" }|,
"YCRTBL@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 423, :col => "increment:5:1", :frequency => "A" }|,
"YCRTFD@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 424, :col => "increment:5:1", :frequency => "A" }|,
"YCRTHC@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 425, :col => "increment:5:1", :frequency => "A" }|,
"YCRTGA@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 426, :col => "increment:5:1", :frequency => "A" }|,
"YCRTCL@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 427, :col => "increment:5:1", :frequency => "A" }|,
"YCRTSP@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 428, :col => "increment:5:1", :frequency => "A" }|,
"YCRTGM@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 429, :col => "increment:5:1", :frequency => "A" }|,
"YCRTMS@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 430, :col => "increment:5:1", :frequency => "A" }|,
"YCRTOT@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 431, :col => "increment:5:1", :frequency => "A" }|,
"YCTW@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 432, :col => "increment:5:1", :frequency => "A" }|,
"YCTWTA@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 433, :col => "increment:5:1", :frequency => "A" }|,
"YCTWTR@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 434, :col => "increment:5:1", :frequency => "A" }|,
"YCTWTW@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 435, :col => "increment:5:1", :frequency => "A" }|,
"YCTWTT@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 436, :col => "increment:5:1", :frequency => "A" }|,
"YCTWTG@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 437, :col => "increment:5:1", :frequency => "A" }|,
"YCTWPL@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 438, :col => "increment:5:1", :frequency => "A" }|,
"YCTWSC@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 439, :col => "increment:5:1", :frequency => "A" }|,
"YCTWSP@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 440, :col => "increment:5:1", :frequency => "A" }|,
"YCTWCU@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 441, :col => "increment:5:1", :frequency => "A" }|,
"YCTWWH@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 442, :col => "increment:5:1", :frequency => "A" }|,
"YCIF@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 443, :col => "increment:5:1", :frequency => "A" }|,
"YCIFPB@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 444, :col => "increment:5:1", :frequency => "A" }|,
"YCIFMP@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 445, :col => "increment:5:1", :frequency => "A" }|,
"YCIFBC@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 446, :col => "increment:5:1", :frequency => "A" }|,
"YCIFIT@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 447, :col => "increment:5:1", :frequency => "A" }|,
"YCIFTC@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 448, :col => "increment:5:1", :frequency => "A" }|,
"YCIFDP@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 449, :col => "increment:5:1", :frequency => "A" }|,
"YCIFOT@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 450, :col => "increment:5:1", :frequency => "A" }|,
"YCFI@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 451, :col => "increment:5:1", :frequency => "A" }|,
"YCFIMO@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 452, :col => "increment:5:1", :frequency => "A" }|,
"YCFICR@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 453, :col => "increment:5:1", :frequency => "A" }|,
"YCFISE@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 454, :col => "increment:5:1", :frequency => "A" }|,
"YCFIIN@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 455, :col => "increment:5:1", :frequency => "A" }|,
"YCFIOT@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 456, :col => "increment:5:1", :frequency => "A" }|,
"YCRE@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 457, :col => "increment:5:1", :frequency => "A" }|,
"YCRERE@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 458, :col => "increment:5:1", :frequency => "A" }|,
"YCRERL@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 459, :col => "increment:5:1", :frequency => "A" }|,
"YCRELE@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 460, :col => "increment:5:1", :frequency => "A" }|,
"YCPS@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 461, :col => "increment:5:1", :frequency => "A" }|,
"YCMA@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 462, :col => "increment:5:1", :frequency => "A" }|,
"YCAD@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 463, :col => "increment:5:1", :frequency => "A" }|,
"YCADAD@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 464, :col => "increment:5:1", :frequency => "A" }|,
"YCADWM@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 465, :col => "increment:5:1", :frequency => "A" }|,
"YCED@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 466, :col => "increment:5:1", :frequency => "A" }|,
"YCHC@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 467, :col => "increment:5:1", :frequency => "A" }|,
"YCHCAM@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 468, :col => "increment:5:1", :frequency => "A" }|,
"YCHCHO@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 469, :col => "increment:5:1", :frequency => "A" }|,
"YCHCNR@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 470, :col => "increment:5:1", :frequency => "A" }|,
"YCHCSO@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 471, :col => "increment:5:1", :frequency => "A" }|,
"YCAE@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 472, :col => "increment:5:1", :frequency => "A" }|,
"YCAEPF@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 473, :col => "increment:5:1", :frequency => "A" }|,
"YCAEMU@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 474, :col => "increment:5:1", :frequency => "A" }|,
"YCAERE@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 475, :col => "increment:5:1", :frequency => "A" }|,
"YCAF@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 476, :col => "increment:5:1", :frequency => "A" }|,
"YCAFAC@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 477, :col => "increment:5:1", :frequency => "A" }|,
"YCAFFD@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 478, :col => "increment:5:1", :frequency => "A" }|,
"YCOS@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 479, :col => "increment:5:1", :frequency => "A" }|,
"YCOSRP@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 480, :col => "increment:5:1", :frequency => "A" }|,
"YCOSPL@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 481, :col => "increment:5:1", :frequency => "A" }|,
"YCOSMA@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 482, :col => "increment:5:1", :frequency => "A" }|,
"YCOSHH@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 483, :col => "increment:5:1", :frequency => "A" }|,
"YCGV@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 484, :col => "increment:5:1", :frequency => "A" }|,
"YCGVFD@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 485, :col => "increment:5:1", :frequency => "A" }|,
"YCGVML@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 486, :col => "increment:5:1", :frequency => "A" }|,
"YC_GVSL@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 487, :col => "increment:5:1", :frequency => "A" }|,
"YCGVST@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 488, :col => "increment:5:1", :frequency => "A" }|,
"YCGVLC@KAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 489, :col => "increment:5:1", :frequency => "A" }|	
		}
		
	com_mau = {
		"YC@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 491, :col => "increment:5:1", :frequency => "A" }|,
"YWAGE@MAU.A" => [%Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 492, :col => "increment:5:1", :frequency => "A" }|,
%Q|Series.load_from_download  "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 565, :col => "increment:5:1", :frequency => "A" }|],  
"YOTLAB@MAU.A" => [%Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 493, :col => "increment:5:1", :frequency => "A" }|,
%Q|Series.load_from_download  "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 566, :col => "increment:5:1", :frequency => "A" }|],  
"YOTLABPEN@MAU.A" => [%Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 494, :col => "increment:5:1", :frequency => "A" }|,
%Q|Series.load_from_download  "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 567, :col => "increment:5:1", :frequency => "A" }|],  
"YOTLABSS@MAU.A" => [%Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 495, :col => "increment:5:1", :frequency => "A" }|,
%Q|Series.load_from_download  "CA05N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 568, :col => "increment:5:1", :frequency => "A" }|],  
"YCAVR@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 496, :col => "increment:5:1", :frequency => "A" }|,
"YCAGFA@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 498, :col => "increment:5:1", :frequency => "A" }|,
"YC_NF@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 499, :col => "increment:5:1", :frequency => "A" }|,
"YC_PR@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 500, :col => "increment:5:1", :frequency => "A" }|,
"YCAGFF@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 501, :col => "increment:5:1", :frequency => "A" }|,
"YCAGFFFO@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 502, :col => "increment:5:1", :frequency => "A" }|,
"YCAGFFFS@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 503, :col => "increment:5:1", :frequency => "A" }|,
"YCAGFFSP@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 504, :col => "increment:5:1", :frequency => "A" }|,
"YCMI@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 505, :col => "increment:5:1", :frequency => "A" }|,
"YCMIOG@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 506, :col => "increment:5:1", :frequency => "A" }|,
"YCMIMI@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 507, :col => "increment:5:1", :frequency => "A" }|,
"YCMISP@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 508, :col => "increment:5:1", :frequency => "A" }|,
"YCUT@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 509, :col => "increment:5:1", :frequency => "A" }|,
"YCCT@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 510, :col => "increment:5:1", :frequency => "A" }|,
"YCCTBL@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 511, :col => "increment:5:1", :frequency => "A" }|,
"YCCTHV@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 512, :col => "increment:5:1", :frequency => "A" }|,
"YCCTSP@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 513, :col => "increment:5:1", :frequency => "A" }|,
"YCMN@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 514, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDR@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 515, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRWD@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 516, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRNM@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 517, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRPM@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 518, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRFB@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 519, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRMC@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 520, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRCM@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 521, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDREL@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 522, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRMV@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 523, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRTR@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 524, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRFR@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 525, :col => "increment:5:1", :frequency => "A" }|,
"YCMNDRMS@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 526, :col => "increment:5:1", :frequency => "A" }|,
"YCMNND@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 527, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDFD@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 528, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDBV@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 529, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDXM@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 530, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDXP@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 531, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDAP@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 532, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDLT@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 533, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDPA@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 534, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDPR@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 535, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDPT@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 536, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDCH@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 537, :col => "increment:5:1", :frequency => "A" }|,
"YCMNNDPL@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 538, :col => "increment:5:1", :frequency => "A" }|,
"YCWT@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 539, :col => "increment:5:1", :frequency => "A" }|,
"YCRT@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 540, :col => "increment:5:1", :frequency => "A" }|,
"YCRTMV@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 541, :col => "increment:5:1", :frequency => "A" }|,
"YCRTFR@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 542, :col => "increment:5:1", :frequency => "A" }|,
"YCRTEL@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 543, :col => "increment:5:1", :frequency => "A" }|,
"YCRTBL@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 544, :col => "increment:5:1", :frequency => "A" }|,
"YCRTFD@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 545, :col => "increment:5:1", :frequency => "A" }|,
"YCRTHC@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 546, :col => "increment:5:1", :frequency => "A" }|,
"YCRTGA@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 547, :col => "increment:5:1", :frequency => "A" }|,
"YCRTCL@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 548, :col => "increment:5:1", :frequency => "A" }|,
"YCRTSP@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 549, :col => "increment:5:1", :frequency => "A" }|,
"YCRTGM@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 550, :col => "increment:5:1", :frequency => "A" }|,
"YCRTMS@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 551, :col => "increment:5:1", :frequency => "A" }|,
"YCRTOT@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 552, :col => "increment:5:1", :frequency => "A" }|,
"YCTW@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 553, :col => "increment:5:1", :frequency => "A" }|,
"YCTWTA@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 554, :col => "increment:5:1", :frequency => "A" }|,
"YCTWTR@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 555, :col => "increment:5:1", :frequency => "A" }|,
"YCTWTW@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 556, :col => "increment:5:1", :frequency => "A" }|,
"YCTWTT@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 557, :col => "increment:5:1", :frequency => "A" }|,
"YCTWTG@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 558, :col => "increment:5:1", :frequency => "A" }|,
"YCTWPL@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 559, :col => "increment:5:1", :frequency => "A" }|,
"YCTWSC@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 560, :col => "increment:5:1", :frequency => "A" }|,
"YCTWSP@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 561, :col => "increment:5:1", :frequency => "A" }|,
"YCTWCU@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 562, :col => "increment:5:1", :frequency => "A" }|,
"YCTWWH@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 563, :col => "increment:5:1", :frequency => "A" }|,
"YCIF@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 564, :col => "increment:5:1", :frequency => "A" }|,
"YCIFPB@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 565, :col => "increment:5:1", :frequency => "A" }|,
"YCIFMP@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 566, :col => "increment:5:1", :frequency => "A" }|,
"YCIFBC@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 567, :col => "increment:5:1", :frequency => "A" }|,
"YCIFIT@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 568, :col => "increment:5:1", :frequency => "A" }|,
"YCIFTC@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 569, :col => "increment:5:1", :frequency => "A" }|,
"YCIFDP@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 570, :col => "increment:5:1", :frequency => "A" }|,
"YCIFOT@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 571, :col => "increment:5:1", :frequency => "A" }|,
"YCFI@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 572, :col => "increment:5:1", :frequency => "A" }|,
"YCFIMO@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 573, :col => "increment:5:1", :frequency => "A" }|,
"YCFICR@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 574, :col => "increment:5:1", :frequency => "A" }|,
"YCFISE@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 575, :col => "increment:5:1", :frequency => "A" }|,
"YCFIIN@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 576, :col => "increment:5:1", :frequency => "A" }|,
"YCFIOT@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 577, :col => "increment:5:1", :frequency => "A" }|,
"YCRE@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 578, :col => "increment:5:1", :frequency => "A" }|,
"YCRERE@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 579, :col => "increment:5:1", :frequency => "A" }|,
"YCRERL@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 580, :col => "increment:5:1", :frequency => "A" }|,
"YCRELE@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 581, :col => "increment:5:1", :frequency => "A" }|,
"YCPS@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 582, :col => "increment:5:1", :frequency => "A" }|,
"YCMA@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 583, :col => "increment:5:1", :frequency => "A" }|,
"YCAD@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 584, :col => "increment:5:1", :frequency => "A" }|,
"YCADAD@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 585, :col => "increment:5:1", :frequency => "A" }|,
"YCADWM@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 586, :col => "increment:5:1", :frequency => "A" }|,
"YCED@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 587, :col => "increment:5:1", :frequency => "A" }|,
"YCHC@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 588, :col => "increment:5:1", :frequency => "A" }|,
"YCHCAM@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 589, :col => "increment:5:1", :frequency => "A" }|,
"YCHCHO@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 590, :col => "increment:5:1", :frequency => "A" }|,
"YCHCNR@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 591, :col => "increment:5:1", :frequency => "A" }|,
"YCHCSO@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 592, :col => "increment:5:1", :frequency => "A" }|,
"YCAE@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 593, :col => "increment:5:1", :frequency => "A" }|,
"YCAEPF@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 594, :col => "increment:5:1", :frequency => "A" }|,
"YCAEMU@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 595, :col => "increment:5:1", :frequency => "A" }|,
"YCAERE@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 596, :col => "increment:5:1", :frequency => "A" }|,
"YCAF@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 597, :col => "increment:5:1", :frequency => "A" }|,
"YCAFAC@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 598, :col => "increment:5:1", :frequency => "A" }|,
"YCAFFD@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 599, :col => "increment:5:1", :frequency => "A" }|,
"YCOS@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 600, :col => "increment:5:1", :frequency => "A" }|,
"YCOSRP@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 601, :col => "increment:5:1", :frequency => "A" }|,
"YCOSPL@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 602, :col => "increment:5:1", :frequency => "A" }|,
"YCOSMA@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 603, :col => "increment:5:1", :frequency => "A" }|,
"YCOSHH@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 604, :col => "increment:5:1", :frequency => "A" }|,
"YCGV@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 605, :col => "increment:5:1", :frequency => "A" }|,
"YCGVFD@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 606, :col => "increment:5:1", :frequency => "A" }|,
"YCGVML@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 607, :col => "increment:5:1", :frequency => "A" }|,
"YC_GVSL@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 608, :col => "increment:5:1", :frequency => "A" }|,
"YCGVST@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 609, :col => "increment:5:1", :frequency => "A" }|,
"YCGVLC@MAU.A" => %Q|Series.load_from_download "CA06N@bea.gov", { :file_type => "csv", :start_date => "2001-01-01", :row => 610, :col => "increment:5:1", :frequency => "A" }|
	}
	
p = Packager.new
p.add_definitions com_hi
p.write_definitions_to "#{ENV['DATA_PATH']}/bea/update/com_upd_HI_NEW.xls"
	
p = Packager.new
p.add_definitions com_haw
p.write_definitions_to "#{ENV['DATA_PATH']}/bea/update/com_upd_HAW_NEW.xls"
	
	p = Packager.new
	p.add_definitions com_hon
	p.write_definitions_to "#{ENV['DATA_PATH']}/bea/update/com_upd_HON_NEW.xls"
	
	p = Packager.new
	p.add_definitions com_kau
	p.write_definitions_to "#{ENV['DATA_PATH']}/bea/update/com_upd_KAU_NEW.xls"
	
	p = Packager.new
	p.add_definitions com_mau
	p.write_definitions_to "#{ENV['DATA_PATH']}/bea/update/com_upd_MAU_NEW.xls"
	
	CSV.open("public/rake_time.csv", "a") {|csv| csv << ["com_upd", "%.2f" % (Time.now - t) , t.to_s, Time.now.to_s] }
end

task :bea_identities => :environment do
  t = Time.now
  #some of the Y's rely on a manul file read in another process...

  #refer to identites in identites in bea_upd.cmd
  # ben just removed
  # "YSAG@HI.A".ts_eval= %Q|"YSAGFA@HI.A".ts + "YSAGFF@HI.A".ts|
	  
  #these are all slightly off... same as below, not needed and wrong anyway 6/28/11
  # "YPCBEA_R@HI.A".ts_eval= %Q|"Y@HI.A".ts / ("CPI@HON.A".ts * "NR@HI.A".ts)|
  # "YPCBEA_R@HON.A".ts_eval= %Q|"Y@HON.A".ts / ("CPI@HON.A".ts * "NR@HON.A".ts)|
  # "YPCBEA_R@HAW.A".ts_eval= %Q|"Y@HAW.A".ts / ("CPI@HON.A".ts * "NR@HAW.A".ts)|
  # "YPCBEA_R@KAU.A".ts_eval= %Q|"Y@KAU.A".ts / ("CPI@HON.A".ts * "NR@KAU.A".ts)|
  # "YPCBEA_R@MAU.A".ts_eval= %Q|"Y@MAU.A".ts / ("CPI@HON.A".ts * "NR@MAU.A".ts)|

  #works, but might need to be overwritten by rebased version if carl says
  "Y_R@HI.Q".ts_eval= %Q|"Y@HI.Q".ts / "CPI@HON.Q".ts  * 100|

  #{}"YPCBEA_R@HON.A".ts_eval= %Q|"Y@HON.A".ts / ("CPI@HON.A".ts * "NR@HON.A".ts)|
  # "YPCBEA_R@HI.A".ts_eval=%Q|"YPCBEA@HI.A".ts / "CPI@HON.A".ts|
  # "YPCBEA_R@KAU.A".ts_eval=%Q|"YPCBEA@KAU.A".ts / "CPI@HON.A".ts|
  # "YPCBEA_R@MAU.A".ts_eval=%Q|"YPCBEA@MAU.A".ts / "CPI@HON.A".ts|
  # "YPCBEA_R@HAW.A".ts_eval=%Q|"YPCBEA@HAW.A".ts / "CPI@HON.A".ts|
  # "YPCBEA_R@HON.A".ts_eval= %Q|"YPCBEA@HON.A".ts / "CPI@HON.A".ts|
  
  # ["HI", "HON", "HAW", "KAU", "MAU"].each do |cnty|
  #   "Y_R@#{cnty}.A".ts_eval= %Q|"Y@#{cnty}.A".ts / "CPI@HON.A".ts|
  #   "YPCBEA_R@#{cnty}.A".ts_eval= %Q|"Y@#{cnty}.A".ts / ("CPI@HON.A".ts * "NR@#{cnty}.A".ts)|
  # end  
  
  
  "GDP_IIV_R@US.A".ts_eval= %Q|"GDP_IIV_R@US.A".tsn.load_from("#{ENV['DATA_PATH']}/rawdata/History/us_upd_a.xls").trim("1900-01-01","1994-12-01")|
  "YCE_R@US.A".ts_eval= %Q|"YCE_R@US.A".tsn.load_from("#{ENV['DATA_PATH']}/rawdata/History/us_upd_a.xls").trim("1900-01-01","1994-12-01")|
  "GDP_IFX_R@US.A".ts_eval= %Q|"GDP_IFX_R@US.A".tsn.load_from("#{ENV['DATA_PATH']}/rawdata/History/us_upd_a.xls").trim("1900-01-01","1994-12-01")|
  "GDP_INR_R@US.A".ts_eval= %Q|"GDP_INR_R@US.A".tsn.load_from("#{ENV['DATA_PATH']}/rawdata/History/us_upd_a.xls").trim("1900-01-01","1994-12-01")|
  "GDP_NX_R@US.A".ts_eval= %Q|"GDP_NX_R@US.A".tsn.load_from("#{ENV['DATA_PATH']}/rawdata/History/us_upd_a.xls").trim("1900-01-01","1994-12-01")|
  "GDP_IFX_R@US.Q".ts_eval= %Q|"GDP_IFX_R@US.Q".tsn.load_from("#{ENV['DATA_PATH']}/rawdata/History/us_upd_q.xls").trim("1900-01-01","1994-12-01")|
  "GDP_NX_R@US.Q".ts_eval= %Q|"GDP_NX_R@US.Q".tsn.load_from("#{ENV['DATA_PATH']}/rawdata/History/us_upd_q.xls").trim("1900-01-01","1994-12-01")|
  "GDP_INR_R@US.Q".ts_eval= %Q|"GDP_INR_R@US.Q".tsn.load_from("#{ENV['DATA_PATH']}/rawdata/History/us_upd_q.xls").trim("1900-01-01","1994-12-01")|
  "GDP_CD_R@US.Q".ts_eval= %Q|"GDP_CD_R@US.Q".tsn.load_from("#{ENV['DATA_PATH']}/rawdata/History/us_upd_q.xls").trim("1900-01-01","1994-12-01")|
  "GDP_IIV_R@US.Q".ts_eval= %Q|"GDP_IIV_R@US.Q".tsn.load_from("#{ENV['DATA_PATH']}/rawdata/History/us_upd_q.xls").trim("1900-01-01","1994-12-01")|
  "GDP_IRS_R@US.Q".ts_eval= %Q|"GDP_IRS_R@US.Q".tsn.load_from("#{ENV['DATA_PATH']}/rawdata/History/us_upd_q.xls").trim("1900-01-01","1994-12-01")|
  "GDP_CS_R@US.Q".ts_eval= %Q|"GDP_CS_R@US.Q".tsn.load_from("#{ENV['DATA_PATH']}/rawdata/History/us_upd_q.xls").trim("1900-01-01","1994-12-01")|
  
  "INFCORE@US.M".ts_eval= %Q| "CPICORE@US.M".ts.annualized_percentage_change |
  "GDP_IRS_R@US.A".ts_eval= %Q|"GDP_IRS_R@US.A".tsn.load_from("#{ENV['DATA_PATH']}/rawdata/History/us_upd_a.xls").trim("1900-01-01","1994-12-01")|
  "GDP_CS_R@US.A".ts_eval= %Q|"GDP_CS_R@US.A".tsn.load_from("#{ENV['DATA_PATH']}/rawdata/History/us_upd_a.xls").trim("1900-01-01","1994-12-01")|
  "GDP_CN_R@US.Q".ts_eval= %Q|"GDP_CN_R@US.Q".tsn.load_from("#{ENV['DATA_PATH']}/rawdata/History/us_upd_q.xls").trim("1900-01-01","1994-12-01")|
  "INF@US.M".ts_eval= %Q| "CPI@US.M".ts.annualized_percentage_change |
  "GDP_CD_R@US.A".ts_eval= %Q|"GDP_CD_R@US.A".tsn.load_from("#{ENV['DATA_PATH']}/rawdata/History/us_upd_a.xls").trim("1900-01-01","1994-12-01")|
  "YCE_R@US.M".ts_eval= %Q|"YCE_R@US.M".tsn.load_from("#{ENV['DATA_PATH']}/rawdata/History/us_upd_m.xls").trim("1900-01-01","1994-12-01")|
  "GDP_CN_R@US.A".ts_eval= %Q|"GDP_CN_R@US.A".tsn.load_from("#{ENV['DATA_PATH']}/rawdata/History/us_upd_a.xls").trim("1900-01-01","1994-12-01")|

  "YP_R@CA.A".ts_eval= %Q|"YP_R@CA.A".tsn.load_from "#{ENV['DATA_PATH']}/rawdata/History/us_upd_a.xls"|
  "CPI@CA.A".ts_eval= %Q|"CPI@CA.A".tsn.load_from "#{ENV['DATA_PATH']}/rawdata/History/us_upd_a.xls"|

  "CAPUMN@US.A".ts_eval= %Q|"CAPUMN@US.Q".ts.aggregate(:year, :average)|

  ["HI", "HON", "MAU", "KAU", "HAW"].each do |cnty|
    "YPC@#{cnty}.A".ts_eval = %Q|"Y@#{cnty}.A".ts / "NR@#{cnty}.A".ts |
  end

  "YPC@HI.Q".ts_eval = %Q|"Y@HI.Q".ts / "NR@HI.Q".ts |

  #wrong
  # "YPC@HI.Q".ts_eval = %Q|"YPCBEA@HI.Q".ts|
  "YPC_R@HI.Q".ts_eval = %Q|"YPC@HI.Q".ts / "CPI@HON.Q".ts * 100|
  
  #this is wrong
  #"YPC@NBI.A".ts_eval = %Q|"YPC@HI.A".ts - "YPC@HON.A".ts|
  
  #A isn't really right either right. Q is wrong. Now A works and other thing is wrong
  "SH_YPC@HON.A".ts_eval = %Q|"YPC@HON.A".ts / "YPC@HI.A".ts|
  #{}"SH_YPC@HON.Q".ts_eval = %Q|"YPC@HON.Q".ts / "YPC@HI.Q".ts|
  
  [""].each do |type|
    ["L", "C"].each do |pre|
      ["HI", "HON", "HAW", "MAU", "KAU"].each do |cnty|
        ("Y#{pre}AG#{type}@#{cnty}.A".ts_eval= %Q|"Y#{pre}AGFA#{type}@#{cnty}.A".ts + "Y#{pre}AGFF#{type}@#{cnty}.A".ts|) rescue puts "ERROR Y#{pre}AG#{type}@#{cnty}.A"
        ("Y#{pre}_CTMI#{type}@#{cnty}.A".ts_eval= %Q|"Y#{pre}CT#{type}@#{cnty}.A".ts + "Y#{pre}MI#{type}@#{cnty}.A".ts|) rescue puts "ERROR Y#{pre}_CTMI#{type}@#{cnty}.A"
        ("Y#{pre}_TU#{type}@#{cnty}.A".ts_eval= %Q|"Y#{pre}TW#{type}@#{cnty}.A".ts + "Y#{pre}UT#{type}@#{cnty}.A".ts|) rescue puts "ERROR Y#{pre}_TU#{type}@#{cnty}.A"
        ("Y#{pre}_TRADE#{type}@#{cnty}.A".ts_eval= %Q|"Y#{pre}WT#{type}@#{cnty}.A".ts + "Y#{pre}RT#{type}@#{cnty}.A".ts|) rescue puts "ERROR Y#{pre}_TRADE#{type}@#{cnty}.A"
        ("Y#{pre}_TTU#{type}@#{cnty}.A".ts_eval= %Q|"Y#{pre}TW#{type}@#{cnty}.A".ts + "Y#{pre}UT#{type}@#{cnty}.A".ts + "Y#{pre}WT#{type}@#{cnty}.A".ts + "Y#{pre}RT#{type}@#{cnty}.A".ts|) rescue puts "ERROR Y#{pre}_TTU#{type}@#{cnty}.A"
        ("Y#{pre}_FIR#{type}@#{cnty}.A".ts_eval= %Q|"Y#{pre}FI#{type}@#{cnty}.A".ts + "Y#{pre}RE#{type}@#{cnty}.A".ts|) rescue puts "ERROR Y#{pre}_FIR#{type}@#{cnty}.A"
        ("Y#{pre}_OT#{type}@#{cnty}.A".ts_eval= %Q|"Y#{pre}MA#{type}@#{cnty}.A".ts + "Y#{pre}AD#{type}@#{cnty}.A".ts + "Y#{pre}OS#{type}@#{cnty}.A".ts|) rescue puts "ERROR Y#{pre}_OT#{type}@#{cnty}.A"
        ("Y#{pre}_ELSE#{type}@#{cnty}.A".ts_eval= %Q|"Y#{pre}IF#{type}@#{cnty}.A".ts + "Y#{pre}AE#{type}@#{cnty}.A".ts + "Y#{pre}PS#{type}@#{cnty}.A".ts + "Y#{pre}MA#{type}@#{cnty}.A".ts + "Y#{pre}AD#{type}@#{cnty}.A".ts + "Y#{pre}ED#{type}@#{cnty}.A".ts + "Y#{pre}OS#{type}@#{cnty}.A".ts|) rescue puts "ERROR Y#{pre}_ELSE#{type}@#{cnty}.A"
        ("Y#{pre}_SV#{type}@#{cnty}.A".ts_eval= %Q|"Y#{pre}HC#{type}@#{cnty}.A".ts + "Y#{pre}AF#{type}@#{cnty}.A".ts + "Y#{pre}_ELSE#{type}@#{cnty}.A".ts|) rescue puts "ERROR Y#{pre}_SV#{type}@#{cnty}.A"
      end
    end

    #not sure we need any of these
    # ["_R"].each do |type|
    #   ["L", "C"].each do |pre|
    #     ["HI", "HON", "HAW", "MAU", "KAU"].each do |cnty|
    #       ("Y#{pre}AG#{type}@#{cnty}.A".ts_eval= %Q|"Y#{pre}AGFA#{type}@#{cnty}.A".ts + "Y#{pre}AGFF#{type}@#{cnty}.A".ts|) rescue puts "ERROR Y#{pre}AG#{type}@#{cnty}.A"
    #       ("Y#{pre}_CTMI#{type}@#{cnty}.A".ts_eval= %Q|"Y#{pre}CT#{type}@#{cnty}.A".ts + "Y#{pre}MI#{type}@#{cnty}.A".ts|) rescue puts "ERROR Y#{pre}_CTMI#{type}@#{cnty}.A"
    #       ("Y#{pre}_TU#{type}@#{cnty}.A".ts_eval= %Q|"Y#{pre}TW#{type}@#{cnty}.A".ts + "Y#{pre}UT#{type}@#{cnty}.A".ts|) rescue puts "ERROR Y#{pre}_TU#{type}@#{cnty}.A"
    #       ("Y#{pre}_TRADE#{type}@#{cnty}.A".ts_eval= %Q|"Y#{pre}WT#{type}@#{cnty}.A".ts + "Y#{pre}RT#{type}@#{cnty}.A".ts|) rescue puts "ERROR Y#{pre}_TRADE#{type}@#{cnty}.A"
    #       ("Y#{pre}_TTU#{type}@#{cnty}.A".ts_eval= %Q|"Y#{pre}TW#{type}@#{cnty}.A".ts + "Y#{pre}UT#{type}@#{cnty}.A".ts + "Y#{pre}WT#{type}@#{cnty}.A".ts + "Y#{pre}RT#{type}@#{cnty}.A".ts|) rescue puts "ERROR Y#{pre}_TTU#{type}@#{cnty}.A"
    #       ("Y#{pre}_FIR#{type}@#{cnty}.A".ts_eval= %Q|"Y#{pre}FI#{type}@#{cnty}.A".ts + "Y#{pre}RE#{type}@#{cnty}.A".ts|) rescue puts "ERROR Y#{pre}_FIR#{type}@#{cnty}.A"
    #       ("Y#{pre}_OT#{type}@#{cnty}.A".ts_eval= %Q|"Y#{pre}MA#{type}@#{cnty}.A".ts + "Y#{pre}AD#{type}@#{cnty}.A".ts + "Y#{pre}OS#{type}@#{cnty}.A".ts|) rescue puts "ERROR Y#{pre}_OT#{type}@#{cnty}.A"
    #       ("Y#{pre}_ELSE#{type}@#{cnty}.A".ts_eval= %Q|"Y#{pre}IF#{type}@#{cnty}.A".ts + "Y#{pre}AE#{type}@#{cnty}.A".ts + "Y#{pre}PS#{type}@#{cnty}.A".ts + "Y#{pre}MA#{type}@#{cnty}.A".ts + "Y#{pre}AD#{type}@#{cnty}.A".ts + "Y#{pre}ED#{type}@#{cnty}.A".ts + "Y#{pre}OS#{type}@#{cnty}.A".ts|) rescue puts "ERROR Y#{pre}_ELSE#{type}@#{cnty}.A"
    #       ("Y#{pre}_SV#{type}@#{cnty}.A".ts_eval= %Q|"Y#{pre}HC#{type}@#{cnty}.A".ts + "Y#{pre}AF#{type}@#{cnty}.A".ts + "Y#{pre}_ELSE#{type}@#{cnty}.A".ts|) rescue puts "ERROR Y#{pre}_SV#{type}@#{cnty}.A"
    #     end
    #   end

  
    ["S", "L"].each do |pre|
      ["HI"].each do |cnty|
        ["A", "Q"].each do |f|
          ("Y#{pre}AG#{type}@#{cnty}.#{f}".ts_eval= %Q|"Y#{pre}AGFA#{type}@#{cnty}.#{f}".ts + "Y#{pre}AGFF#{type}@#{cnty}.#{f}".ts|) rescue puts "ERROR Y#{pre}AG#{type}@#{cnty}.#{f}"
          ("Y#{pre}_CTMI#{type}@#{cnty}.#{f}".ts_eval= %Q|"Y#{pre}CT#{type}@#{cnty}.#{f}".ts + "Y#{pre}MI#{type}@#{cnty}.#{f}".ts|) rescue puts "ERROR Y#{pre}_CTMI#{type}@#{cnty}.#{f}"
          ("Y#{pre}_TU#{type}@#{cnty}.#{f}".ts_eval= %Q|"Y#{pre}TW#{type}@#{cnty}.#{f}".ts + "Y#{pre}UT#{type}@#{cnty}.#{f}".ts|) rescue puts "ERROR Y#{pre}_TU#{type}@#{cnty}.#{f}"
          ("Y#{pre}_TRADE#{type}@#{cnty}.#{f}".ts_eval= %Q|"Y#{pre}WT#{type}@#{cnty}.#{f}".ts + "Y#{pre}RT#{type}@#{cnty}.#{f}".ts|) rescue puts "ERROR Y#{pre}_TRADE#{type}@#{cnty}.#{f}"
          ("Y#{pre}_TTU#{type}@#{cnty}.#{f}".ts_eval= %Q|"Y#{pre}TW#{type}@#{cnty}.#{f}".ts + "Y#{pre}UT#{type}@#{cnty}.#{f}".ts + "Y#{pre}WT#{type}@#{cnty}.#{f}".ts + "Y#{pre}RT#{type}@#{cnty}.#{f}".ts|) rescue puts "ERROR Y#{pre}_TTU#{type}@#{cnty}.#{f}"
          ("Y#{pre}_FIR#{type}@#{cnty}.#{f}".ts_eval= %Q|"Y#{pre}FI#{type}@#{cnty}.#{f}".ts + "Y#{pre}RE#{type}@#{cnty}.#{f}".ts|) rescue puts "ERROR Y#{pre}_FIR#{type}@#{cnty}.#{f}"
          ("Y#{pre}_OT#{type}@#{cnty}.#{f}".ts_eval= %Q|"Y#{pre}MA#{type}@#{cnty}.#{f}".ts + "Y#{pre}AD#{type}@#{cnty}.#{f}".ts + "Y#{pre}OS#{type}@#{cnty}.#{f}".ts|) rescue puts "ERROR Y#{pre}_OT#{type}@#{cnty}.#{f}"
          ("Y#{pre}_ELSE#{type}@#{cnty}.#{f}".ts_eval= %Q|"Y#{pre}IF#{type}@#{cnty}.#{f}".ts + "Y#{pre}AE#{type}@#{cnty}.#{f}".ts + "Y#{pre}PS#{type}@#{cnty}.#{f}".ts + "Y#{pre}MA#{type}@#{cnty}.#{f}".ts + "Y#{pre}AD#{type}@#{cnty}.#{f}".ts + "Y#{pre}ED#{type}@#{cnty}.#{f}".ts + "Y#{pre}OS#{type}@#{cnty}.#{f}".ts|) rescue puts "ERROR Y#{pre}_ELSE#{type}@#{cnty}.#{f}"
          ("Y#{pre}_SV#{type}@#{cnty}.#{f}".ts_eval= %Q|"Y#{pre}HC#{type}@#{cnty}.#{f}".ts + "Y#{pre}AF#{type}@#{cnty}.#{f}".ts + "Y#{pre}_ELSE#{type}@#{cnty}.#{f}".ts|) rescue puts "ERROR Y#{pre}_SV#{type}@#{cnty}.#{f}"
        end
      end
    end
  end


  #These two blocks take care of 2500 series!
  ["YC", "YL"].each do |pre|
    ["ADAD", "ADWM", "AD", "AEMU", "AEPF", "AERE", "AE", "AFAC", "AFFD", "AF", "AGFA", "AGFFFO", "AGFFFS", "AGFFOT", "AGFFSP", "AGFF", "AG", "AVR", "CTBL", "CTHV", "CTSP", "CT", "ED", "FICR", "FIIN", "FIMO", "FIOT", "FISE", "FI", "GVFD", "GVLC", "GVML", "GVST", "GV", "HCAM", "HCHO", "HCNR", "HCSO", "HC", "IFBC", "IFDP", "IFIT", "IFMP", "IFOT", "IFPB", "IFTC", "IF", "MA", "MIMI", "MIOG", "MISP", "MI", "MNDRCM", "MNDREL", "MNDRFB", "MNDRFR", "MNDRMC", "MNDRMS", "MNDRMV", "MNDRNM", "MNDRPM", "MNDRTR", "MNDRWD", "MNDR", "MNNDAP", "MNNDBV", "MNNDCH", "MNNDFD", "MNNDLT", "MNNDPA", "MNNDPL", "MNNDPR", "MNNDPT", "MNNDXM", "MNNDXP", "MNND", "MN", "OSHH", "OSMA", "OSPL", "OSRP", "OS", "PS", "RELE", "RERE", "RERL", "RE", "RTBL", "RTCL", "RTEL", "RTFD", "RTFR", "RTGA", "RTGM", "RTHC", "RTMS", "RTMV", "RTOT", "RTSP", "RT", "TWCU", "TWPL", "TWSC", "TWSP", "TWTA", "TWTG", "TWTR", "TWTT", "TWTW", "TWWH", "TW", "UT", "WT", "_CTMI", "_ELSE", "_FIR", "_GVSL", "_NF", "_OT", "_PR", "", "_SV", "_TRADE", "_TTU", "_TU"].each do |type|
      ("#{pre}#{type}@NBI.A".ts_eval= %Q|"#{pre}#{type}@HI.A".ts - "#{pre}#{type}@HON.A".ts|) rescue puts "NBI ERROR FORM #{pre}#{type}"
      ["HI", "HON", "MAU", "HAW", "KAU", "NBI"].each do |cnty|
        ("#{pre}#{type}_R@#{cnty}.A".ts_eval= %Q|"#{pre}#{type}@#{cnty}.A".ts / "CPI@HON.A".ts * 100|) rescue puts "_R ERROR FORM #{pre}#{type}_R@#{cnty}"
      end
    end
  end

  
  #YPC base series needs corrections
  ["YDIV", "YNETR", "YOTLABPEN", "YOTLABSS", "YOTLAB", "YPCBEA", "YPROPFA", "YPROPNF", "YPROP", "YRESADJ", "YSOCSECEM", "YSOCSECPR", "YSOCSEC", "YTRNSF", "YWAGE", "Y"].each do |pre|
    ("#{pre}@NBI.A".ts_eval= %Q|"#{pre}@HI.A".ts - "#{pre}@HON.A".ts|) rescue puts "NBI ERROR FORM #{pre}"
    ["HI", "HON", "MAU", "HAW", "KAU", "NBI"].each do |cnty|
      ("#{pre}_R@#{cnty}.A".ts_eval= %Q|"#{pre}@#{cnty}.A".ts / "CPI@HON.A".ts * 100|) rescue puts "_R ERROR FORM #{pre}_R@#{cnty}"
    end
  end

  #YPC calculated above needs to get overwritte. Should maybe remove
  "YPC@NBI.A".ts_eval= %Q|"Y@NBI.A".ts / "NR@NBI.A".ts|

  ["YPC"].each do |pre|
    ["HI", "HON", "MAU", "HAW", "KAU", "NBI"].each do |cnty|
      ("#{pre}_R@#{cnty}.A".ts_eval= %Q|"#{pre}@#{cnty}.A".ts / "CPI@HON.A".ts * 100|) rescue puts "_R ERROR FORM #{pre}_R@#{cnty}"
    end
  end
  
  # _R ERROR FORM YTRNSFOT_R@HI
  #   _R ERROR FORM YTRNSFUI_R@HI
  #   _R ERROR FORM YXR_R@HI
  ["YSADAD", "YSADWM", "YSAD", "YSAEPF", "YSAERE", "YSAE", "YSAFAC", "YSAFFD", "YSAF", "YSAGFA", "YSAGFF", "YSAG", "YSCT", "YSED", "YSFIIN", "YSFIMC", "YSFIOT", "YSFISE", "YSFI", "YSGVFD", "YSGVML", "YSGV", "YSHCAM", "YSHCHO", "YSHCSO", "YSHC", "YSIFBC", "YSIFDP", "YSIFMP", "YSIFPB", "YSIF", "YSMA", "YSMIMI", "YSMIOG", "YSMISP", "YSMI", "YSMNDRCM", "YSMNDREL", "YSMNDRFB", "YSMNDRFR", "YSMNDRMC", "YSMNDRMS", "YSMNDRMV", "YSMNDRNM", "YSMNDRPM", "YSMNDRTR", "YSMNDRWD", "YSMNDR", "YSMNNDAP", "YSMNNDCH", "YSMNNDFD", "YSMNNDPA", "YSMNNDPL", "YSMNNDPR", "YSMNNDPT", "YSMNNDXX", "YSMNND", "YSMN", "YSOS", "YSPSCO", "YSPSLS", "YSPSOS", "YSPS", "YSRERE", "YSRERL", "YSRE", "YSRT", "YSTWPL", "YSTWSP", "YSTWTA", "YSTWTG", "YSTWTR", "YSTWTT", "YSTWTW", "YSTWWH", "YSTW", "YSUT", "YSWT", "YS_CTMI", "YS_ELSE", "YS_FIR", "YS_GVSL", "YS_OT", "YS_PR", "YS", "YS_SV", "YS_TRADE", "YS_TTU", "YS_TU", "YTRNSFOT", "YTRNSFUI", "YXR"].each do |pre|
    ("#{pre}_R@HI.A".ts_eval= %Q|"#{pre}@HI.A".ts / "CPI@HON.A".ts * 100|) rescue puts "_R ERROR FORM #{pre}_R@HI"
  end

  # "#{pre}#{type}@NBI.A".ts_eval= %Q|"#{pre}#{type}@HI.A".ts - "#{pre}#{type}@HON.A".ts|
  # "#{pre}#{type}@NBI.A".ts_eval= %Q|"#{pre}#{type}@HI.A".ts - "#{pre}#{type}@HON.A".ts|

  #{}"YPC@HI.Q", "YPC", "YXR", "YXR", "YXR"
  
  ["YDIV", "YLAD", "YLAE", "YLAF", "YLAGFA", "YLAGFF", "YLAG", "YLCT", "YLED", "YLFI", "YLGVFD", "YLGVML", "YLGV", "YLHC", "YLIF", "YLMA", "YLMI", "YLMNDR", "YLMNND", "YLMN", "YLOS", "YLPS", "YLRE", "YLRT", "YLTW", "YLUT", "YLWT", "YL_CTMI", "YL_ELSE", "YL_FIR", "YL_GVSL", "YL_NF", "YL_OT", "YL_PR", "YL", "YL_SV", "YL_TRADE", "YL_TTU", "YL_TU", "YNETR", "YOTLABPEN", "YOTLABSS", "YOTLAB", "YPROPFA", "YPROPNF", "YPROP", "YRESADJ", "YSOCSECEM", "YSOCSECPR", "YSOCSEC", "YTRNSFOT", "YTRNSFUI", "YTRNSF", "YWAGE"].each do |pre|
    ("#{pre}_R@HI.Q".ts_eval= %Q|"#{pre}@HI.Q".ts / "CPI@HON.Q".ts * 100|) rescue puts "_R ERROR FORM #{pre}_R@HI"
  end

  "YL_TR@NBI.A".ts_eval= %Q|"YL_TR@HI.A".ts - "YL_TR@HON.A".ts|
  "YL_TR_R@HI.A".ts_eval= %Q|"YL_TR@HI.A".ts / "CPI@HON.A".ts * 100|
  "YL_TR_R@HON.A".ts_eval= %Q|"YL_TR@HON.A".ts / "CPI@HON.A".ts * 100|
  "YL_TR_R@MAU.A".ts_eval= %Q|"YL_TR@MAU.A".ts / "CPI@HON.A".ts * 100|
  "YL_TR_R@NBI.A".ts_eval= %Q|"YL_TR@NBI.A".ts / "CPI@HON.A".ts * 100|

#  "CSCF@US.A".ts_eval= %Q|"CSCF@US.Q".ts.aggregate(:year, :average)|
  "CSCF@JP.A".ts_eval= %Q|"CSCFNS@JP.Q".ts.aggregate(:year, :average)|

  # Not sure how this is supposed to work. These don't work
  "YXR_R@JP.M".ts_eval= %Q|"YXR@JP.M".ts * "CPI@US.M".ts / "CPI@JP.M".ts|
  "YXR_R@JP.A".ts_eval= %Q|"YXR@JP.A".ts * "CPI@US.A".ts.rebase("2000-01-01") / "CPI@JP.A".ts.rebase("2000-01-01")|
  #this one doesn't quite work
  #need to distribute annual average to quarters... might have this somewhere
  "YXR_R@JP.Q".ts_eval= %Q|"YXR@JP.Q".ts * "CPI@US.Q".ts.rebase("2000-01-01") / "CPI@JP.Q".ts.rebase("2000-01-01")|
  
  
  #loads in & series from history instead
  #this generates "correct" _R & series. for now reading from file
  # pre = "YL"
  # ["PAGFA", "PAGFF1", "PAGFF2", "PAGFF3", "PAGFFA", "PAGFFF", "PAGFF", "PAG", "PCGB", "PCHV", "PCST", "PC", "PFIRCR", "PFIRDP", "PFIRHD", "PFIRIA", "PFIRIC", "PFIROF", "PFIRRE", "PFIRSE", "PFIR", "PGFC", "PGFM", "PGL", "PGSL", "PGST", "PG", "PMDEL", "PMDFB", "PMDFR", "PMDIS", "PMDMC", "PMDMS", "PMDMV", "PMDOR", "PMDPM", "PMDST", "PMDTR", "PMDWD", "PMD", "PMICO", "PMIMT", "PMINM", "PMIOL", "PMI", "PMNAP", "PMNCH", "PMNFD", "PMNLT", "PMNPA", "PMNPR", "PMNPT", "PMNRB", "PMNTB", "PMNXM", "PMN", "PM", "PRCM", "PRLT", "PROT", "PRPL", "PRSV", "PRTA", "PRTR", "PRTT", "PRTW", "PRUT", "PR", "PSVAM", "PSVAU", "PSVBS", "PSVED", "PSVEN", "PSVHE", "PSVHL", "PSVLG", "PSVMB", "PSVMO", "PSVMR", "PSVMS", "PSVMU", "PSVPH", "PSVPS", "PSVSO", "PSV", "PTRAP", "PTRAT", "PTRBL", "PTRET", "PTRFD", "PTRFR", "PTRGM", "PTROT", "PTR", "PTW", "P", "_NF", "_PR"].each do |type| 
  #   ("#{pre}#{type}&@NBI.A".ts_eval= %Q|"#{pre}#{type}&@HI.A".ts - "#{pre}#{type}&@HON.A".ts|) rescue puts "NBI ERROR FORM #{pre}#{type}&"
  #   ["HI", "HON", "MAU", "HAW", "KAU", "NBI"].each do |cnty|
  #     ("#{pre}#{type}_R&@#{cnty}.A".ts_eval= %Q|"#{pre}#{type}&@#{cnty}.A".ts / "CPI@HON.A".ts * 100|) rescue puts "_R ERROR FORM #{pre}#{type}_R&@#{cnty}"
  #   end
  # end
  
  #just for matching units
  # pre = "YL"
  # ["PAGFA", "PAGFF1", "PAGFF2", "PAGFF3", "PAGFFA", "PAGFFF", "PAGFF", "PAG", "PCGB", "PCHV", "PCST", "PC", "PFIRCR", "PFIRDP", "PFIRHD", "PFIRIA", "PFIRIC", "PFIROF", "PFIRRE", "PFIRSE", "PFIR", "PGFC", "PGFM", "PGL", "PGSL", "PGST", "PG", "PMDEL", "PMDFB", "PMDFR", "PMDIS", "PMDMC", "PMDMS", "PMDMV", "PMDOR", "PMDPM", "PMDST", "PMDTR", "PMDWD", "PMD", "PMICO", "PMIMT", "PMINM", "PMIOL", "PMI", "PMNAP", "PMNCH", "PMNFD", "PMNLT", "PMNPA", "PMNPR", "PMNPT", "PMNRB", "PMNTB", "PMNXM", "PMN", "PM", "PRCM", "PRLT", "PROT", "PRPL", "PRSV", "PRTA", "PRTR", "PRTT", "PRTW", "PRUT", "PR", "PSVAM", "PSVAU", "PSVBS", "PSVED", "PSVEN", "PSVHE", "PSVHL", "PSVLG", "PSVMB", "PSVMO", "PSVMR", "PSVMS", "PSVMU", "PSVPH", "PSVPS", "PSVSO", "PSV", "PTRAP", "PTRAT", "PTRBL", "PTRET", "PTRFD", "PTRFR", "PTRGM", "PTROT", "PTR", "PTW", "P", "_NF", "_PR"].each do |type| 
  #   ("#{pre}#{type}&@NBI.A".ts.find_units) rescue puts "NBI ERROR FORM #{pre}#{type}&"
  #   # ["HI", "HON", "MAU", "HAW", "KAU", "NBI"].each do |cnty|
  #   #   ("#{pre}#{type}_R&@#{cnty}.A".ts.find_units) rescue puts "_R ERROR FORM #{pre}#{type}_R&@#{cnty}"
  #   # end
  # end
  # @HON
   # 
   #     calculate famsize and sh_ypc
   
   
   
   "FAMSIZE_TEMP@HON.A".ts_eval= %Q|"YMED@HON.A".ts / "YPC@HON.A".ts|
   "SH_YPC_TEMP@HON.A".ts_eval= %Q|"YPC@HON.A".ts/"YPC@HI.A".ts|
   
   "FAMSIZE@HON.Q".ts_eval = %Q|"FAMSIZE_TEMP@HON.A".ts.pseudo_centered_spline_interpolation(:quarter)|
   "SH_YPC@HON.Q".ts_eval = %Q|"SH_YPC_TEMP@HON.A".ts.pseudo_centered_spline_interpolation(:quarter)|

   "FAMSIZE2@HON.Q".ts_eval = %Q|"FAMSIZE@HON.Q".ts|
   #may also want to change this to extend... or just extend on both sides...
   "FAMSIZE2@HON.Q".ts_eval = %Q|"FAMSIZE2@HON.Q".ts.extend_first_data_point_back_to("1970-01-01")|
   "FAMSIZE2@HON.Q".ts_eval = %Q|"FAMSIZE2@HON.Q".ts.extend_last_date_to_match("YPC@HI.Q")|
   "SH_YPC@HON.Q".ts_eval = %Q|"SH_YPC@HON.Q".ts.extend_last_date_to_match("YPC@HI.Q")|

   #the ones coming up clean are already defined... in MISC... should move? dependencies are split between this and MISC transformations
   #"HPMT@HON.Q".ts_eval=   %Q|"PMKRSGF@HON.Q".ts * 0.8 * ("RMORT@US.Q".ts / 1200) / (("RMORT@US.Q".ts / 1200 + 1)**-360 * -1 + 1)|
   #"HYQUAL@HON.Q".ts_eval= %Q|"HPMT@HON.Q".ts * 10 / 3 * 12|
   #{}"HPMTCON@HON.Q".ts_eval= %Q|"PMKRCON@HON.Q".ts * 0.8 * ("RMORT@US.Q".ts / 1200) / (("RMORT@US.Q".ts / 1200 + 1)**-360 * -1 + 1)|
   #{}"HYQUALCON@HON.Q".ts_eval= %Q|"HPMTCON@HON.Q".ts * 10 / 3 * 12|
   
   "PAFSGF@HON.Q".ts_eval = %Q| ("FAMSIZE2@HON.Q".ts * "SH_YPC@HON.Q".ts * "YPC@HI.Q".ts / "RMORT@US.Q".ts)*(("RMORT@US.Q".ts / 1200 + 1)**-360 * -1 + 1) * (300/8) |
   "HAI@HON.Q".ts_eval= %Q|("FAMSIZE2@HON.Q".ts * "SH_YPC@HON.Q".ts * "YPC@HI.Q".ts) / "HYQUAL@HON.Q".ts * 100 * 1000|
   "HAICON@HON.Q".ts_eval= %Q|("FAMSIZE2@HON.Q".ts * "SH_YPC@HON.Q".ts * "YPC@HI.Q".ts) / "HYQUALCON@HON.Q".ts * 100 * 1000|   
   "FAMSIZE@HON.A".ts_eval= %Q|"FAMSIZE@HON.Q".ts.aggregate(:year, :average)|

   #this (SH_YPC) seems to be flopping back and forth. Commenting this one out for now and deleting from UDAMAN
   #{}"SH_YPC@HON.A".ts_eval= %Q|"SH_YPC@HON.Q".ts.aggregate(:year, :average)|
   
   
   "FAMSIZE_TEMP@HI.A".ts_eval= %Q|"YMED@HI.A".ts / "YPC@HI.A".ts|
   "FAMSIZE_TEMP@HI.A".ts_eval= %Q|("FAMSIZE@HON.A".ts * (("YMED@HI.A".ts / "YPC@HI.A".ts) / "FAMSIZE@HON.A".ts).average).trim("1990-01-01","1996-01-01")|
   
   "FAMSIZE@HI.Q".ts_eval = %Q|"FAMSIZE_TEMP@HI.A".ts.pseudo_centered_spline_interpolation(:quarter)|
   "FAMSIZE@HI.Q".ts_eval = %Q|"FAMSIZE@HI.Q".ts.extend_last_date_to_match("YPC@HI.Q")|
   
   "PAFSGF@HI.Q".ts_eval = %Q| ("FAMSIZE@HI.Q".ts * "YPC@HI.Q".ts / "RMORT@US.Q".ts)*(("RMORT@US.Q".ts / 1200 + 1)**-360 * -1 + 1) * (300/8) |
   "HAI@HI.Q".ts_eval= %Q|("FAMSIZE@HI.Q".ts * "YPC@HI.Q".ts) / "HYQUAL@HI.Q".ts * 100 * 1000|
   "HAICON@HI.Q".ts_eval= %Q|("FAMSIZE@HI.Q".ts * "YPC@HI.Q".ts) / "HYQUALCON@HI.Q".ts * 100 * 1000|   
   "FAMSIZE@HI.A".ts_eval= %Q|"FAMSIZE@HI.Q".ts.aggregate(:year, :average)|
   

  CSV.open("public/rake_time.csv", "a") {|csv| csv << ["bea_identities", "%.2f" % (Time.now - t) , t.to_s, Time.now.to_s] }

end
