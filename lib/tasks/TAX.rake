#TAX SERIES DOWNLOADS

###*******************************************************************
###NOTES BOX

#With the download being to a zip file, there seems to be a problem in unzipping the data to a usable form.

###*******************************************************************


task :tax_upd => :environment do
  require "Spreadsheet"
  #path_tax_collec_May11       = "/Volumes/UHEROwork/data/rawdata/2011-05/05collec.xls"
  #path_tax_GE_Mar11           = "/Volumes/UHEROwork/data/rawdata/2011-05/03ge.xls"
  path_tax_collec       = "/Volumes/UHEROwork/data/rawdata/TAX/%Y/%mcollec.xls"
  path_tax_GE           = "/Volumes/UHEROwork/data/rawdata/TAX/%Y/%mge.xls"
  
  output_path_collec   = "/Volumes/UHEROwork/data/tax/update/tax_upd_collec_NEW.xls"
  output_path_ge       = "/Volumes/UHEROwork/data/tax/update/tax_upd_ge_NEW.xls"
 
  #dsd_tax_collec_May11     = DataSourceDownload.get path_tax_collec_May11
  #dsd_tax_GE_Mar11         = DataSourceDownload.get path_tax_GE_Mar11    
    
  #if dsd_tax_collec_May11.download_changed? || dsd_tax_GE_Mar11 .download_changed?

    sox = SeriesOutputXls.new(output_path_collec)#,true)
      
  sox.add "TRFINS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 5, 6)
  sox.add "TRCVNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 6, 6)
  sox.add "TREMNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 7, 6)
  sox.add "TRFUNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 8, 6)
  sox.add "TRGLNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 9, 6)
  sox.add "TRGTNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 10, 6)
  sox.add "TRHSNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 11, 6)
  sox.add "TRCOESNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 13, 6)
  sox.add "TRCOPRNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 14, 6)
  sox.add "TRCORFNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 15, 6)
  sox.add "TRINESNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 17, 6)
  sox.add "TRINPRNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 18, 6)
  sox.add "TRINWHNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 19, 6)
  sox.add "TRINRFNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 20, 6)
  sox.add "TRIHNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 21, 6)
  sox.add "TRISNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 23, 6)
  sox.add "TRLINS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 24, 6)
  sox.add "TRMTNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 25, 6)
  sox.add "TRPSNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 26, 6)
  sox.add "TRTBNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 27, 6)
  sox.add "TRTFNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 28, 6)
  sox.add "TRTTNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 29, 6)
  sox.add "TROTNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 30, 6)
  sox.add "TRNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 31, 6)
  sox.add "TRFINS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 5, 2)
  sox.add "TRCVNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 6, 2)
  sox.add "TREMNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 7, 2)
  sox.add "TRFUNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 8, 2)
  sox.add "TRGLNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 9, 2)
  sox.add "TRGTNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 10, 2)
  sox.add "TRHSNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 11, 2)
  sox.add "TRCOESNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 13, 2)
  sox.add "TRCOPRNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 14, 2)
  sox.add "TRCORFNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 15, 2)
  sox.add "TRINESNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 17, 2)
  sox.add "TRINPRNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 18, 2)
  sox.add "TRINWHNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 19, 2)
  sox.add "TRINRFNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 20, 2)
  sox.add "TRIHNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 21, 2)
  sox.add "TRISNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 23, 2)
  sox.add "TRLINS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 24, 2)
  sox.add "TRMTNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 25, 2)
  sox.add "TRPSNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 26, 2)
  sox.add "TRTBNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 27, 2)
  sox.add "TRTFNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 28, 2)
  sox.add "TRTTNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 29, 2)
  sox.add "TROTNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 30, 2)
  sox.add "TRNS@HON.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 31, 2)
  sox.add "TRFINS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 5, 3)
  sox.add "TRCVNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 6, 3)
  sox.add "TREMNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 7, 3)
  sox.add "TRFUNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 8, 3)
  sox.add "TRGLNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 9, 3)
  sox.add "TRGTNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 10, 3)
  sox.add "TRHSNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 11, 3)
  sox.add "TRCOESNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 13, 3)
  sox.add "TRCOPRNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 14, 3)
  sox.add "TRCORFNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 15, 3)
  sox.add "TRINESNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 17, 3)
  sox.add "TRINPRNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 18, 3)
  sox.add "TRINWHNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 19, 3)
  sox.add "TRINRFNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 20, 3)
  sox.add "TRIHNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 21, 3)
  sox.add "TRISNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 23, 3)
  sox.add "TRLINS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 24, 3)
  sox.add "TRMTNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 25, 3)
  sox.add "TRPSNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 26, 3)
  sox.add "TRTBNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 27, 3)
  sox.add "TRTFNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 28, 3)
  sox.add "TRTTNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 29, 3)
  sox.add "TROTNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 30, 3)
  sox.add "TRNS@MAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 31, 3)
  sox.add "TRFINS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 5, 4)
  sox.add "TRCVNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 6, 4)
  sox.add "TREMNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 7, 4)
  sox.add "TRFUNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 8, 4)
  sox.add "TRGLNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 9, 4)
  sox.add "TRGTNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 10, 4)
  sox.add "TRHSNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 11, 4)
  sox.add "TRCOESNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 13, 4)
  sox.add "TRCOPRNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 14, 4)
  sox.add "TRCORFNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 15, 4)
  sox.add "TRINESNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 17, 4)
  sox.add "TRINPRNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 18, 4)
  sox.add "TRINWHNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 19, 4)
  sox.add "TRINRFNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 20, 4)
  sox.add "TRIHNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 21, 4)
  sox.add "TRISNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 23, 4)
  sox.add "TRLINS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 24, 4)
  sox.add "TRMTNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 25, 4)
  sox.add "TRPSNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 26, 4)
  sox.add "TRTBNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 27, 4)
  sox.add "TRTFNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 28, 4)
  sox.add "TRTTNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 29, 4)
  sox.add "TROTNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 30, 4)
  sox.add "TRNS@HAW.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 31, 4)
  sox.add "TRFINS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 5, 5)
  sox.add "TRCVNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 6, 5)
  sox.add "TREMNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 7, 5)
  sox.add "TRFUNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 8, 5)
  sox.add "TRGLNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 9, 5)
  sox.add "TRGTNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 10, 5)
  sox.add "TRHSNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 11, 5)
  sox.add "TRCOESNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 13, 5)
  sox.add "TRCOPRNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 14, 5)
  sox.add "TRCORFNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 15, 5)
  sox.add "TRINESNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 17, 5)
  sox.add "TRINPRNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 18, 5)
  sox.add "TRINWHNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 19, 5)
  sox.add "TRINRFNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 20, 5)
  sox.add "TRIHNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 21, 5)
  sox.add "TRISNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 23, 5)
  sox.add "TRLINS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 24, 5)
  sox.add "TRMTNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 25, 5)
  sox.add "TRPSNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 26, 5)
  sox.add "TRTBNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 27, 5)
  sox.add "TRTFNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 28, 5)
  sox.add "TRTTNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 29, 5)
  sox.add "TROTNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 30, 5)
  sox.add "TRNS@KAU.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 31, 5)
  sox.add "TDGFNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 36, 6)
  sox.add "TDHWNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 37, 6)
  sox.add "TDAPNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 38, 6)
  sox.add "TDBONS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 39, 6)
  sox.add "TDEVNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 40, 6)
  sox.add "TDCANS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 41, 6)
  sox.add "TDCENS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 42, 6)
  sox.add "TDEMNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 45, 6)
  sox.add "TDRHNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 46, 6)
  sox.add "TDNANS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 47, 6)
  sox.add "TDCVNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 48, 6)
  sox.add "TDTTNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 49, 4)
  sox.add "TDTSNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 51, 6)
  sox.add "TDCTFUNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 66, 6)
  sox.add "TDCTTTNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 67, 6)
  sox.add "TDCTNS@HI.M",         Series.load_pattern("2011-01-01", "M", path_tax_collec, "sheet_num:1", 68, 6)

 sox.write_xls

    sox = SeriesOutputXls.new(output_path_ge)#,true)

  sox.add "TGBRTNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 38, 6)
  sox.add "TGBSVNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 39, 6)
  sox.add "TGBCTNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 40, 6)
  sox.add "TGBTHNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 41, 6)
  sox.add "TGBITNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 42, 6)
  sox.add "TGBCMNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 43, 6)
  sox.add "TGBHTNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 44, 6)
  sox.add "TGBORNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 45, 6)
  sox.add "TGBU4NS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 46, 6)
  sox.add "TGBOTNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 47, 6)
  sox.add "TGBISNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 50, 6)
  sox.add "TGBSUNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 51, 6)
  sox.add "TGBPINS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 52, 6)
  sox.add "TGBPDNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 53, 6)
  sox.add "TGBMNNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 54, 6)
  sox.add "TGBWTNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 55, 6)
  sox.add "TGBSINS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 56, 6)
  sox.add "TGBU5NS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 57, 6)
  sox.add "TGBNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 60, 6)
  sox.add "TGBRTNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 38, 2)
  sox.add "TGBSVNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 39, 2)
  sox.add "TGBCTNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 40, 2)
  sox.add "TGBTHNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 41, 2)
  sox.add "TGBITNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 42, 2)
  sox.add "TGBCMNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 43, 2)
  sox.add "TGBHTNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 44, 2)
  sox.add "TGBORNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 45, 2)
  sox.add "TGBU4NS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 46, 2)
  sox.add "TGBOTNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 47, 2)
  sox.add "TGBISNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 50, 2)
  sox.add "TGBSUNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 51, 2)
  sox.add "TGBPINS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 52, 2)
  sox.add "TGBPDNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 53, 2)
  sox.add "TGBMNNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 54, 2)
  sox.add "TGBWTNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 55, 2)
  sox.add "TGBSINS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 56, 2)
  sox.add "TGBU5NS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 57, 2)
  sox.add "TGBNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 60, 2)
  sox.add "TGBRTNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 38, 3)
  sox.add "TGBSVNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 39, 3)
  sox.add "TGBCTNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 40, 3)
  sox.add "TGBTHNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 41, 3)
  sox.add "TGBITNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 42, 3)
  sox.add "TGBCMNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 43, 3)
  sox.add "TGBHTNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 44, 3)
  sox.add "TGBORNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 45, 3)
  sox.add "TGBU4NS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 46, 3)
  sox.add "TGBOTNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 47, 3)
  sox.add "TGBISNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 50, 3)
  sox.add "TGBSUNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 51, 3)
  sox.add "TGBPINS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 52, 3)
  sox.add "TGBPDNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 53, 3)
  sox.add "TGBMNNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 54, 3)
  sox.add "TGBWTNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 55, 3)
  sox.add "TGBSINS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 56, 3)
  sox.add "TGBU5NS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 57, 3)
  sox.add "TGBNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 60, 3)
  sox.add "TGBRTNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 38, 4)
  sox.add "TGBSVNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 39, 4)
  sox.add "TGBCTNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 40, 4)
  sox.add "TGBTHNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 41, 4)
  sox.add "TGBITNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 42, 4)
  sox.add "TGBCMNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 43, 4)
  sox.add "TGBHTNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 44, 4)
  sox.add "TGBORNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 45, 4)
  sox.add "TGBU4NS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 46, 4)
  sox.add "TGBOTNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 47, 4)
  sox.add "TGBISNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 50, 4)
  sox.add "TGBSUNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 51, 4)
  sox.add "TGBPINS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 52, 4)
  sox.add "TGBPDNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 53, 4)
  sox.add "TGBMNNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 54, 4)
  sox.add "TGBWTNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 55, 4)
  sox.add "TGBSINS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 56, 4)
  sox.add "TGBU5NS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 57, 4)
  sox.add "TGBNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 60, 4)
  sox.add "TGBRTNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 38, 5)
  sox.add "TGBSVNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 39, 5)
  sox.add "TGBCTNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 40, 5)
  sox.add "TGBTHNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 41, 5)
  sox.add "TGBITNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 42, 5)
  sox.add "TGBCMNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 43, 5)
  sox.add "TGBHTNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 44, 5)
  sox.add "TGBORNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 45, 5)
  sox.add "TGBU4NS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 46, 5)
  sox.add "TGBOTNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 47, 5)
  sox.add "TGBISNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 50, 5)
  sox.add "TGBSUNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 51, 5)
  sox.add "TGBPINS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 52, 5)
  sox.add "TGBPDNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 53, 5)
  sox.add "TGBMNNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 54, 5)
  sox.add "TGBWTNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 55, 5)
  sox.add "TGBSINS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 56, 5)
  sox.add "TGBU5NS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 57, 5)
  sox.add "TGBNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 60, 5)
  sox.add "TGRRTNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 6, 6)
  sox.add "TGRSVNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 7, 6)
  sox.add "TGRCTNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 8, 6)
  sox.add "TGRTHNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 9, 6)
  sox.add "TGRITNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 10, 6)
  sox.add "TGRCMNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 11, 6)
  sox.add "TGRHTNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 12, 6)
  sox.add "TGRORNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 13, 6)
  sox.add "TGRU4NS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 14, 6)
  sox.add "TGROTNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 15, 6)
  sox.add "TGRISNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 18, 6)
  sox.add "TGRSUNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 19, 6)
  sox.add "TGRPINS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 20, 6)
  sox.add "TGRPDNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 21, 6)
  sox.add "TGRMNNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 22, 6)
  sox.add "TGRWTNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 23, 6)
  sox.add "TGRSINS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 24, 6)
  sox.add "TGRU5NS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 25, 6)
  sox.add "TGRALNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 28, 6)
  sox.add "TGRUANS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 30, 6)
  sox.add "TGRNS@HI.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 32, 6)
  sox.add "TGRRTNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 6, 2)
  sox.add "TGRSVNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 7, 2)
  sox.add "TGRCTNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 8, 2)
  sox.add "TGRTHNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 9, 2)
  sox.add "TGRITNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 10, 2)
  sox.add "TGRCMNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 11, 2)
  sox.add "TGRHTNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 12, 2)
  sox.add "TGRORNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 13, 2)
  sox.add "TGRU4NS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 14, 2)
  sox.add "TGROTNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 15, 2)
  sox.add "TGRISNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 18, 2)
  sox.add "TGRSUNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 19, 2)
  sox.add "TGRPINS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 20, 2)
  sox.add "TGRPDNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 21, 2)
  sox.add "TGRMNNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 22, 2)
  sox.add "TGRWTNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 23, 2)
  sox.add "TGRSINS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 24, 2)
  sox.add "TGRU5NS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 25, 2)
  sox.add "TGRALNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 28, 2)
  sox.add "TGRUANS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 30, 2)
  sox.add "TGRNS@HON.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 32, 2)
  sox.add "TGRRTNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 6, 3)
  sox.add "TGRSVNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 7, 3)
  sox.add "TGRCTNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 8, 3)
  sox.add "TGRTHNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 9, 3)
  sox.add "TGRITNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 10, 3)
  sox.add "TGRCMNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 11, 3)
  sox.add "TGRHTNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 12, 3)
  sox.add "TGRORNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 13, 3)
  sox.add "TGRU4NS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 14, 3)
  sox.add "TGROTNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 15, 3)
  sox.add "TGRISNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 18, 3)
  sox.add "TGRSUNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 19, 3)
  sox.add "TGRPINS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 20, 3)
  sox.add "TGRPDNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 21, 3)
  sox.add "TGRMNNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 22, 3)
  sox.add "TGRWTNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 23, 3)
  sox.add "TGRSINS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 24, 3)
  sox.add "TGRU5NS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 25, 3)
  sox.add "TGRALNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 28, 3)
  sox.add "TGRUANS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 30, 3)
  sox.add "TGRNS@MAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 32, 3)
  sox.add "TGRRTNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 6, 4)
  sox.add "TGRSVNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 7, 4)
  sox.add "TGRCTNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 8, 4)
  sox.add "TGRTHNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 9, 4)
  sox.add "TGRITNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 10, 4)
  sox.add "TGRCMNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 11, 4)
  sox.add "TGRHTNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 12, 4)
  sox.add "TGRORNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 13, 4)
  sox.add "TGRU4NS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 14, 4)
  sox.add "TGROTNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 15, 4)
  sox.add "TGRISNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 18, 4)
  sox.add "TGRSUNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 19, 4)
  sox.add "TGRPINS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 20, 4)
  sox.add "TGRPDNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 21, 4)
  sox.add "TGRMNNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 22, 4)
  sox.add "TGRWTNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 23, 4)
  sox.add "TGRSINS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 24, 4)
  sox.add "TGRU5NS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 25, 4)
  sox.add "TGRALNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 28, 4)
  sox.add "TGRUANS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 30, 4)
  sox.add "TGRNS@HAW.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 32, 4)
  sox.add "TGRRTNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 6, 5)
  sox.add "TGRSVNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 7, 5)
  sox.add "TGRCTNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 8, 5)
  sox.add "TGRTHNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 9, 5)
  sox.add "TGRITNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 10, 5)
  sox.add "TGRCMNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 11, 5)
  sox.add "TGRHTNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 12, 5)
  sox.add "TGRORNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 13, 5)
  sox.add "TGRU4NS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 14, 5)
  sox.add "TGROTNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 15, 5)
  sox.add "TGRISNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 18, 5)
  sox.add "TGRSUNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 19, 5)
  sox.add "TGRPINS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 20, 5)
  sox.add "TGRPDNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 21, 5)
  sox.add "TGRMNNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 22, 5)
  sox.add "TGRWTNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 23, 5)
  sox.add "TGRSINS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 24, 5)
  sox.add "TGRU5NS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 25, 5)
  sox.add "TGRALNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 28, 5)
  sox.add "TGRUANS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 30, 5)
  sox.add "TGRNS@KAU.M",         Series.load_pattern("2011-03-01", "M", path_tax_GE, "sheet_num:1", 32, 5)
   
          sox.write_xls
   # NotificationMailer.deliver_new_download_notification "Tax (tax_upd_m)", sox.output_summary
  end
#end


###*******************************************************************