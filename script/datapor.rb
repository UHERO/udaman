#!/usr/bin/env ruby

def wipe(ids)
    ids.each do |id|
        m = Measurement.find(id)
        if m.nil?
            return
        end
        to_replace = []
        m.series.each do |s|
            if s.geography.handle == "HI" and s.name.include? "NS@"
                to_replace.push s
            end
            # annual series don't have the string NS@
            if s.frequency_code == "A" and s.geography.handle == "HI"
                to_replcae.push s
            end
        end
        m.replace_all_series(to_replace)
    end
end

def leak(ids)
    ans = []
    ans.push Series.find_by(name: "TDCTFUNS@HI.M")
    ans.push Series.find_by(name: "TDCTTTNS@HI.M")
    ans.push Series.find_by(name: "TDCTNS@HI.M")
    ids.each do |id|
        m = Measurement.find(id)
        if m.nil?
            return
        end
        m.series.each do |s|
            if s.geography.handle != "HI"
                ans.push s
            end
            if not s.name.include? "NS@" and s.frequency_code != "A"
                ans.push s
            end
        end
    end
    ans
end

targets = [
    "TR", "TRCO", "TRCOES", "TRCOPR", "TRCORF", "TRCV", "TREM", "TRFI", "TRFU", "TRGL", "TRGT", "TRHS", "TRIH", "TRIN", "TRINES", "TRINPR", "TRINRF", "TRINWH", "TRIS", "TRLI", "TRLI", "TRMS", "TRMT", "TROT", "TRPS", "TRTB", "TRTF", "TRTT", "TR_EX", "TDAP", "TDBO", "TDCA", "TDCE", "TDCT", "TDCTFU", "TDCTTT", "TDCV", "TDEM", "TDEV", "TDGF", "TDHW", "TDNA", "TDRH", "TDTS", "TDTT", "TGB", "TGBCM", "TGBCT", "TGBHT", "TGBIS", "TGBIT", "TGBITO", "TGBMN", "TGBOR", "TGBOT", "TGBPD", "TGBPI", "TGBRT", "TGBSI", "TGBSU", "TGBSV", "TGBTH", "TGBU4", "TGBU5", "TGBWT", "TGR", "TGRAL", "TGRCM", "TGRCT", "TGRHT", "TGRIS", "TGRIT", "TGRITO", "TGRMN", "TGROR", "TGROT", "TGRPD", "TGRPI", "TGRRT", "TGRSI", "TGRSU", "TGRSV", "TGRTH", "TGRU4", "TGRU5", "TGRUA", "TGRWT"
]
ms = []  # measurements
ms_ids = []  # their ids
targets.each do |t|
    a = Measurement.find_by(prefix: t)
    if a.nil?
        puts t
    end
    next if a.nil?
    ms.push a
    ms_ids.push a.id
end
b = leak ms_ids

# leak gets the bad series in each measurement id
b.each do |c|
    puts c.name
end

puts b.length


